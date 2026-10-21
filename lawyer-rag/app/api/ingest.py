"""
LawyerAI RAG System - Document Ingestion API Endpoints

Provides endpoints for:
- Ingesting new PDF documents into the vector store + knowledge graph
- Processing amendment acts with override logic
- Batch ingestion of all documents from the Acts directory
- File upload with rich metadata (admin document management)
"""

import os
import re
import shutil
import subprocess
import logging
import traceback
from pathlib import Path
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename

from app.config import config
from app.utils.errors import error_response
from app.core.chunker import smart_legal_chunk
from app.core.vectorstore import add_documents, delete_document_by_name
from app.core.graph_store import get_knowledge_graph
from app.core.entity_extractor import extract_all_entities
from app.ingestion.pdf_parser import extract_text_from_pdf, get_pdf_info
from app.ingestion.metadata_builder import (
    build_metadata_from_filename,
    build_metadata_manual,
)
from app.ingestion.amendment_processor import process_amendment
import fitz
import re
from app.core.llm import get_llm, message_text

logger = logging.getLogger(__name__)

ingest_bp = Blueprint("ingest", __name__)


class UnsafeUpload(Exception):
    """Raised when an uploaded filename cannot be made safe."""


# Directories a caller may name a file inside. Everything else is refused.
#
# WHY. `file_path` in the JSON body and `source_dir` in /api/ingest/batch were
# arbitrary local paths — Stage 0 closed the UPLOAD traversal and left these two
# open, recorded in RAG-ROADMAP as "should become an allow-listed directory in
# Stage 3". Behind the service token they are not anonymous, but "authenticated"
# is not the same as "harmless":
#
#   * any readable file on the host could be ingested into the corpus and then
#     read straight back out through /api/documents — an arbitrary file read
#     dressed up as legislation;
#   * anything ingested becomes RETRIEVED CONTEXT, which the model is told to
#     answer from. That is indirect prompt injection with a file-read primitive
#     attached, and it is the one attack this service's context handling cannot
#     defend against, because retrieved text is trusted by construction.
#
# The token was pasted into a chat on 2026-09-19 and is still pending rotation,
# so "behind the token" is doing less work right now than it looks like.
_INGEST_ROOTS = (
    Path(config.UPLOADS_DIR).resolve(),
    Path(config.ACTS_SOURCE_DIR).resolve(),
)


def _resolve_ingest_path(raw: str):
    """
    Resolve a caller-supplied path, or None if it escapes the allowed roots.

    resolve() first, then containment — the same order as `_save_upload`, and
    for the same reason: a string check for "../" is defeated by symlinks, by
    absolute paths and by encodings, whereas comparing resolved paths is what
    actually holds.
    """
    try:
        candidate = Path(raw).expanduser().resolve()
    except (OSError, RuntimeError):
        return None
    for root in _INGEST_ROOTS:
        if candidate == root or candidate.is_relative_to(root):
            return candidate
    return None


def _save_upload(file, *, require_pdf: bool = True) -> str:
    """
    Save an uploaded file into UPLOADS_DIR, and nowhere else.

    Every upload route used to do this:

        pdf_path = str(uploads_dir / file.filename)   # attacker-controlled
        file.save(pdf_path)

    secure_filename was not imported anywhere in this service, and werkzeug's
    save() does not sanitise. A filename of '../../app/core/llm.py' therefore
    wrote wherever the process could write — including over this service's own
    source, which is arbitrary code execution on the next restart. That was
    reproduced against the running service, not inferred: a POST with the
    filename '../../PWNED-PROOF.pdf' landed the file two directories above the
    uploads folder.

    Two checks, deliberately, because they fail differently:

      secure_filename()  flattens the traversal into a harmless name, so
                         '../../../../tmp/pwned.pdf' becomes 'tmp_pwned.pdf'.
                         It has had bypasses historically, so it is not trusted
                         on its own.
      resolve + is_relative_to  is the actual guarantee. Whatever the name ends
                         up as, the resolved destination must sit inside
                         UPLOADS_DIR or nothing is written.

    The extension check runs against the SANITISED name, never the raw one.
    The old check was `file.filename.lower().endswith('.pdf')`, which
    '../../../evil.pdf' satisfies perfectly.
    """
    uploads_dir = Path(config.UPLOADS_DIR).resolve()
    uploads_dir.mkdir(parents=True, exist_ok=True)

    raw_name = file.filename or ""
    safe = secure_filename(raw_name)

    if not safe:
        # secure_filename returns '' for names that are entirely separators,
        # dots or control characters.
        raise UnsafeUpload("Invalid filename")

    if require_pdf and not safe.lower().endswith(".pdf"):
        raise UnsafeUpload("Only PDF files are supported")

    dest = (uploads_dir / safe).resolve()
    if not dest.is_relative_to(uploads_dir):
        raise UnsafeUpload("Invalid filename")

    file.save(str(dest))
    if raw_name != safe:
        logger.warning(
            "Upload filename sanitised: %r -> %r", raw_name[:120], safe
        )
    logger.info(f"Saved uploaded file to: {dest}")
    return str(dest)


def _generate_document_outline(pdf_path: str, title: str) -> list[dict]:
    """
    Generate a dynamic, structured outline for a legal document using programmatic
    extraction of Part/Chapter markers and LLM-based summarization (with fallback).
    """
    try:
        doc = fitz.open(pdf_path)
        part_pattern = re.compile(r"^\s*(PART\s+[IVXLCDM\d]+)\s*$", re.IGNORECASE)
        chapter_pattern = re.compile(r"^\s*(CHAPTER\s+[IVXLCDM\d]+)\s*$", re.IGNORECASE)
        
        candidates = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")
            lines = [l.strip() for l in text.split("\n") if l.strip()]
            
            for i, line in enumerate(lines):
                is_part = part_pattern.match(line)
                is_chap = chapter_pattern.match(line)
                
                if is_part or is_chap:
                    full_title = line
                    # Look ahead to grab the subtitle
                    subtitle_parts = []
                    for j in range(1, 3):
                        if i + j < len(lines):
                            next_line = lines[i+j]
                            if part_pattern.match(next_line) or chapter_pattern.match(next_line):
                                break
                            if re.match(r"^\d+[\.\s]", next_line):
                                break
                            if len(next_line) < 60:
                                subtitle_parts.append(next_line)
                            else:
                                break
                    
                    if subtitle_parts:
                        full_title = f"{line}: {' '.join(subtitle_parts)}"
                    
                    # Grab subsequent lines for context
                    context_lines = []
                    start_idx = i + 1 + len(subtitle_parts)
                    for next_line in lines[start_idx:start_idx+12]:
                        if part_pattern.match(next_line) or chapter_pattern.match(next_line):
                            break
                        context_lines.append(next_line)
                    
                    following_text = " ".join(context_lines).strip()
                    candidates.append({
                        "page": page_num + 1,
                        "type": "PART" if is_part else "CHAPTER",
                        "title": full_title,
                        "context": following_text
                    })
        
        doc.close()
        
        # Deduplicate candidates
        filtered = []
        seen_titles = set()
        for c in candidates:
            clean_title = re.sub(r'[^a-zA-Z0-9]', '', c['title'].lower())
            if clean_title in seen_titles:
                continue
            seen_titles.add(clean_title)
            filtered.append(c)
            
        # Inherit empty context from next item
        for idx, c in enumerate(filtered):
            if not c["context"]:
                for k in range(idx + 1, len(filtered)):
                    if filtered[k]["context"]:
                        c["context"] = filtered[k]["context"]
                        break
        
        # Generate summaries using LLM (with robust fallback)
        outline = []
        for c in filtered[:15]:  # Generate up to 15 items
            summary = ""
            if c["context"]:
                try:
                    llm = get_llm()
                    prompt = (
                        f"Write a concise, 1-sentence summary (max 20 words) for the following legal section:\n"
                        f"Heading: {c['title']}\n"
                        f"Content: {c['context'][:500]}\n\n"
                        f"Summary:"
                    )
                    response = llm.invoke(prompt)
                    summary = message_text(response).strip()
                except Exception as e:
                    logger.warning(f"LLM outline summary failed for {c['title']}: {e}")
            
            # Programmatic fallback summary
            if not summary:
                raw_summary = c["context"] or ""
                raw_summary = re.sub(r'^\s*\d+\.\s*', '', raw_summary)
                if len(raw_summary) > 150:
                    summary = raw_summary[:150].strip() + "..."
                else:
                    summary = raw_summary.strip()
            
            outline.append({
                "title": c["title"],
                "page": c["page"],
                "summary": summary
            })
            
        return outline
    except Exception as e:
        logger.error(f"Failed to generate outline: {e}")
        return []


def _build_knowledge_graph(chunks: list, document_name: str) -> dict:
    """
    Build knowledge graph entities and relationships from document chunks.
    
    Args:
        chunks: List of LangChain Document objects
        document_name: The document name for entity association
        
    Returns:
        Dict with entity_count and relationship_count
    """
    if not config.ENABLE_GRAPH_RAG:
        return {"entity_count": 0, "relationship_count": 0}

    kg = get_knowledge_graph()
    total_entities = 0
    total_relationships = 0

    for chunk in chunks:
        entities, relationships = extract_all_entities(
            text=chunk.page_content,
            document_name=document_name,
            document_metadata=chunk.metadata,
            use_llm=False,  # Use regex only for speed; set True for richer extraction
        )

        for entity in entities:
            kg.add_entity(
                entity_id=entity.entity_id,
                entity_type=entity.entity_type,
                name=entity.name,
                document_name=entity.document_name or document_name,
                **entity.extra,
            )
            total_entities += 1

        for rel in relationships:
            kg.add_relationship(
                source_id=rel.source_id,
                target_id=rel.target_id,
                relationship_type=rel.relationship_type,
                **rel.extra,
            )
            total_relationships += 1

    # Persist the graph
    kg.save()

    logger.info(
        f"Graph built for '{document_name}': "
        f"{total_entities} entities, {total_relationships} relationships"
    )

    return {
        "entity_count": total_entities,
        "relationship_count": total_relationships,
    }


@ingest_bp.route("/api/ingest", methods=["POST"])
def ingest_document():
    """
    Ingest a single PDF document into the vector store and knowledge graph.

    Accepts either:
    1. A file upload (multipart/form-data with 'file' field)
    2. A JSON body with 'file_path' pointing to a local PDF

    Optional JSON/form fields for metadata overrides:
    - document_name: Override auto-detected document name
    - document_type: "Consolidated Act" or "Amendment Act"
    - status: "Active" or "Repealed"
    - last_updated_year: Override year
    - category: Document category for classification
    - description: Document description
    """
    try:
        pdf_path = None
        metadata_overrides = {}

        # Check for file upload
        if "file" in request.files:
            file = request.files["file"]
            if file.filename == "":
                return jsonify({"error": "No file selected"}), 400

            # Save uploaded file to data/uploads directory.
            # This route had no extension check at all before Stage 0.
            try:
                pdf_path = _save_upload(file)
            except UnsafeUpload as e:
                return jsonify({"error": str(e)}), 400

            # Get metadata from form fields
            for field_name in ("document_name", "document_type", "status",
                               "last_updated_year", "act_number", "category",
                               "description", "court_name", "case_number",
                               "gazette_number"):
                val = request.form.get(field_name)
                if val:
                    metadata_overrides[field_name] = val
        else:
            # Check for file_path in JSON body
            data = request.get_json(silent=True) or {}
            pdf_path = data.get("file_path")
            metadata_overrides = {
                k: v for k, v in data.items()
                if k in ("document_name", "document_type", "status",
                         "last_updated_year", "act_number", "category",
                         "description", "court_name", "case_number",
                         "gazette_number")
                and v is not None
            }

        if not pdf_path:
            return jsonify({"error": "No file provided. Use 'file' upload or 'file_path' in JSON body."}), 400

        # Containment BEFORE existence. Reporting "file not found" for a path
        # outside the allowed roots answers "does /etc/shadow exist on this
        # host?", which is the probe rather than the ingest.
        resolved = _resolve_ingest_path(pdf_path)
        if resolved is None:
            logger.warning("Rejected ingest of a path outside the allowed roots")
            return jsonify({
                "error": "file_path must name a file inside the uploads or acts directory"
            }), 400
        pdf_path = str(resolved)

        if not resolved.exists():
            return jsonify({"error": "File not found"}), 404

        # Get PDF info
        pdf_info = get_pdf_info(pdf_path)
        filename = Path(pdf_path).name

        # Build metadata
        base_metadata = build_metadata_from_filename(filename)
        base_metadata.update(metadata_overrides)

        logger.info(f"Ingesting: {filename} → metadata: {base_metadata}")

        # Extract text
        full_text = extract_text_from_pdf(pdf_path)

        if not full_text.strip():
            return jsonify({"error": "Could not extract text from PDF. File may be image-based."}), 400

        # Chunk document
        chunks = smart_legal_chunk(
            full_text=full_text,
            chunk_size=config.CHUNK_SIZE,
            chunk_overlap=config.CHUNK_OVERLAP,
            metadata_base=base_metadata,
        )

        if not chunks:
            return jsonify({"error": "No chunks created from document"}), 400

        # Add to vector store
        chunks_added = add_documents(chunks)

        # Build knowledge graph
        graph_stats = _build_knowledge_graph(
            chunks=chunks,
            document_name=base_metadata.get("document_name", filename),
        )

        # Generate outline
        outline = _generate_document_outline(pdf_path, base_metadata.get("document_name", filename))

        result = {
            "success": True,
            "message": f"Successfully ingested '{filename}'",
            "document_metadata": base_metadata,
            "pdf_info": pdf_info,
            "chunks_created": len(chunks),
            "chunks_added": chunks_added,
            "graph_stats": graph_stats,
            "outline": outline,
        }

        logger.info(f"Ingestion complete: {result}")
        return jsonify(result), 200

    except Exception as e:
        return error_response(e, "Ingestion failed", 500, context="ingestion")


@ingest_bp.route("/api/ingest/upload", methods=["POST"])
def upload_and_ingest():
    """
    Upload a PDF file and ingest it with rich metadata.
    Designed for the admin document management UI.

    Expects multipart/form-data with:
    - file: PDF file (required)
    - title: Document title (required)
    - category: Document category (required)
    - description: Document description (optional)
    - act_number: Act number (optional)
    - year: Year (optional)
    - court_name: Court name (optional, for case laws)
    - case_number: Case number (optional, for case laws)
    - gazette_number: Gazette number (optional)

    Returns ingestion results including graph stats.
    """
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "No file selected"}), 400

        # Note: the extension is checked inside _save_upload, against the
        # SANITISED name. The check that used to live here ran against the raw
        # filename, which '../../../evil.pdf' satisfies.

        # Get required fields
        title = request.form.get("title", "").strip()
        category = request.form.get("category", "").strip()

        if not title:
            return jsonify({"error": "Document title is required"}), 400
        if not category:
            return jsonify({"error": "Document category is required"}), 400

        # Save file
        try:
            pdf_path = _save_upload(file)
        except UnsafeUpload as e:
            return jsonify({"error": str(e)}), 400

        # The stored file name, not the one the caller sent. They can differ:
        # secure_filename rewrites anything unsafe, and source_file has to name
        # the file that is actually on disk or the citation points at nothing.
        stored_name = Path(pdf_path).name

        # Get optional metadata
        year_str = request.form.get("year", "")
        year = int(year_str) if year_str.isdigit() else 0

        # Build metadata
        metadata = build_metadata_manual(
            document_name=title,
            document_type=_category_to_doc_type(category),
            status="Active",
            last_updated_year=year,
            act_number=request.form.get("act_number", "Unknown"),
            source_file=stored_name,
        )
        metadata["category"] = category
        metadata["description"] = request.form.get("description", "")
        metadata["court_name"] = request.form.get("court_name", "")
        metadata["case_number"] = request.form.get("case_number", "")
        metadata["gazette_number"] = request.form.get("gazette_number", "")

        # Get PDF info
        pdf_info = get_pdf_info(pdf_path)

        # Extract text. A scan (older Acts on Parliament's site are page images)
        # has none: OCR it once, in place, and read again.
        full_text = extract_text_from_pdf(pdf_path)
        ocr_used = False
        if not full_text.strip():
            ocr_error = _ocr_in_place(pdf_path)
            if ocr_error:
                return jsonify({"error": ocr_error}), 400
            full_text = extract_text_from_pdf(pdf_path)
            ocr_used = True
            if not full_text.strip():
                return jsonify({"error": "This PDF is a scan and OCR found no readable text in it."}), 400

        # The caller may say what the PDF must name, e.g. "No. 32 of 1991".
        # Parliament's listing has linked the wrong PDF (its Penal Code
        # (Amendment) No. 32 of 1991 opens the Telecommunications Act), and a
        # wrong text filed under a law is worse than none.
        expect = request.form.get("expect_text", "").strip()
        if expect and not _mentions(full_text[:20000], expect):
            Path(pdf_path).unlink(missing_ok=True)
            return jsonify({
                "error": f'This PDF does not mention "{expect}" on its first pages, so it may be the wrong file. Nothing was added to the AI.'
            }), 422

        # Chunk
        chunks = smart_legal_chunk(
            full_text=full_text,
            chunk_size=config.CHUNK_SIZE,
            chunk_overlap=config.CHUNK_OVERLAP,
            metadata_base=metadata,
        )

        if not chunks:
            return jsonify({"error": "No chunks created from document"}), 400

        # Add to vector store
        chunks_added = add_documents(chunks)

        # Build knowledge graph
        graph_stats = _build_knowledge_graph(
            chunks=chunks,
            document_name=title,
        )

        # Generate outline
        outline = _generate_document_outline(pdf_path, title)

        return jsonify({
            "success": True,
            "message": f"Successfully uploaded and ingested '{title}'",
            "document_name": title,
            "category": category,
            "pdf_info": pdf_info,
            "chunks_created": len(chunks),
            "chunks_added": chunks_added,
            "graph_stats": graph_stats,
            "outline": outline,
            # The text came from OCR of a scan: it can misread a few words.
            "ocr_used": ocr_used,
        }), 200

    except Exception as e:
        return error_response(e, "Upload ingestion failed", 500, context="upload ingestion")


# Long enough for a 50-page scan (about 30 s on an M-series Mac), short of
# gunicorn's 120 s worker timeout, which would kill the whole request.
OCR_TIMEOUT_SECONDS = int(os.getenv("OCR_TIMEOUT_SECONDS", "90"))


def _ocr_in_place(pdf_path: str) -> str | None:
    """
    Add a text layer to a scanned PDF with ocrmypdf (English), replacing the
    file. The page images are kept, so the PDF still looks like the original.
    Returns an error message, or None on success. Needs `ocrmypdf` installed:
    `brew install ocrmypdf` on a Mac, `apt install ocrmypdf` on the server.
    """
    exe = shutil.which("ocrmypdf")
    if not exe:
        return "This PDF is a scan (pictures of pages, no text). Install ocrmypdf so the AI can read it."
    out = Path(pdf_path).with_suffix(".ocr.pdf")
    try:
        subprocess.run(
            [exe, "--skip-text", "-l", "eng", "--optimize", "1", "-q", str(pdf_path), str(out)],
            check=True, capture_output=True, timeout=OCR_TIMEOUT_SECONDS,
        )
        os.replace(out, pdf_path)
        logger.info("OCR added a text layer to %s", Path(pdf_path).name)
        return None
    except subprocess.TimeoutExpired:
        out.unlink(missing_ok=True)
        return f"This PDF is a scan and reading it took longer than {OCR_TIMEOUT_SECONDS} seconds. Try a smaller file."
    except subprocess.CalledProcessError as e:
        out.unlink(missing_ok=True)
        logger.warning("ocrmypdf failed on %s: %s", Path(pdf_path).name, e.stderr.decode(errors="replace")[-500:])
        return "This PDF is a scan and OCR could not read it."


def _mentions(text: str, expect: str) -> bool:
    """True when `text` contains `expect`, ignoring case, spacing and the dot in
    "No." - PDFs print "ACT, No. 32 OF 1991" and "No.32 of 1991" alike."""
    words = [re.escape(w) for w in re.split(r"[\s.]+", expect) if w]
    return bool(words) and re.search(r"[\s.]*".join(words), text, re.IGNORECASE) is not None


def _category_to_doc_type(category: str) -> str:
    """Map document category to document type."""
    mapping = {
        "Sri Lanka Law Reports": "Case Law",
        "Acts & Ordinances": "Consolidated Act",
        "Amendment Acts": "Amendment Act",
        "Gazette Notifications": "Gazette",
        "Supreme Court Decisions": "Case Law",
        "Court of Appeal Decisions": "Case Law",
    }
    return mapping.get(category, "Act")


@ingest_bp.route("/api/ingest/amendment", methods=["POST"])
def ingest_amendment():
    """
    Process and ingest an amendment act.

    This will:
    1. Parse the amendment PDF
    2. Detect which sections of the principal act are affected
    3. Mark old sections as "Repealed" in ChromaDB
    4. Insert new amendment chunks as "Active"

    Request Body (JSON):
    {
        "file_path": "path/to/amendment.pdf",
        "principal_act_name": "Civil Procedure Code"
    }

    Or file upload with form fields.
    """
    try:
        pdf_path = None
        principal_act_name = None

        if "file" in request.files:
            file = request.files["file"]
            if file.filename == "":
                return jsonify({"error": "No file selected"}), 400

            # The roadmap called this "both upload paths". There are three —
            # this one saves an attacker-controlled filename too.
            try:
                pdf_path = _save_upload(file)
            except UnsafeUpload as e:
                return jsonify({"error": str(e)}), 400
            principal_act_name = request.form.get("principal_act_name")
        else:
            data = request.get_json(silent=True) or {}
            pdf_path = data.get("file_path")
            principal_act_name = data.get("principal_act_name")

        if not pdf_path:
            return jsonify({"error": "No file provided"}), 400

        if not principal_act_name:
            return jsonify({
                "error": "Missing 'principal_act_name'. Specify which act this amendment modifies."
            }), 400

        if not Path(pdf_path).exists():
            return jsonify({"error": f"File not found: {pdf_path}"}), 404

        # Process the amendment
        report = process_amendment(
            amendment_pdf_path=pdf_path,
            principal_act_name=principal_act_name,
        )

        return jsonify({
            "success": True,
            "message": f"Amendment processed successfully",
            **report,
        }), 200

    except Exception as e:
        return error_response(e, "Amendment processing failed", 500, context="amendment")


@ingest_bp.route("/api/ingest/batch", methods=["POST"])
def ingest_batch():
    """
    Batch ingest all PDF files from the Acts source directory.

    Request Body (optional):
    {
        "clear_existing": false,  // If true, clears vector store before ingesting
        "source_dir": "path/to/acts"  // Override default acts directory
    }
    """
    try:
        data = request.get_json(silent=True) or {}
        clear_existing = data.get("clear_existing", False)
        source_dir = data.get("source_dir", config.ACTS_SOURCE_DIR)

        source_path = _resolve_ingest_path(str(source_dir))
        if source_path is None:
            logger.warning("Rejected batch ingest of a directory outside the allowed roots")
            return jsonify({
                "error": "source_dir must be the uploads or acts directory"
            }), 400
        if not source_path.exists():
            return jsonify({"error": "Source directory not found"}), 404

        # Find all PDF files
        pdf_files = list(source_path.glob("*.pdf"))
        if not pdf_files:
            return jsonify({"error": f"No PDF files found in {source_dir}"}), 404

        # Optionally clear existing data
        if clear_existing:
            from app.core.vectorstore import get_vectorstore
            vs = get_vectorstore()
            collection = vs._collection
            # Delete all documents
            all_ids = collection.get()["ids"]
            if all_ids:
                collection.delete(ids=all_ids)
                logger.info(f"Cleared {len(all_ids)} existing chunks")

        results = []
        total_chunks = 0

        for pdf_file in sorted(pdf_files):
            try:
                filename = pdf_file.name
                logger.info(f"Batch processing: {filename}")

                # Build metadata
                base_metadata = build_metadata_from_filename(filename)

                # Extract text
                full_text = extract_text_from_pdf(str(pdf_file))

                if not full_text.strip():
                    results.append({
                        "file": filename,
                        "status": "skipped",
                        "reason": "No text extracted",
                    })
                    continue

                # Chunk
                chunks = smart_legal_chunk(
                    full_text=full_text,
                    chunk_size=config.CHUNK_SIZE,
                    chunk_overlap=config.CHUNK_OVERLAP,
                    metadata_base=base_metadata,
                )

                # Add to vector store
                chunks_added = add_documents(chunks)
                total_chunks += chunks_added

                # Build knowledge graph
                graph_stats = _build_knowledge_graph(
                    chunks=chunks,
                    document_name=base_metadata.get("document_name", filename),
                )

                results.append({
                    "file": filename,
                    "status": "success",
                    "document_name": base_metadata.get("document_name"),
                    "document_type": base_metadata.get("document_type"),
                    "chunks_created": len(chunks),
                    "chunks_added": chunks_added,
                    "graph_stats": graph_stats,
                })

            except Exception as e:
                logger.error(f"Error processing {pdf_file.name}: {e}", exc_info=True)
                results.append({
                    "file": pdf_file.name,
                    "status": "error",
                    "error": "Processing failed; see the service log",
                })

        return jsonify({
            "success": True,
            "message": f"Batch ingestion complete",
            "total_files_processed": len(pdf_files),
            "total_chunks_added": total_chunks,
            "details": results,
        }), 200

    except Exception as e:
        return error_response(e, "Batch ingestion failed", 500, context="batch ingestion")
