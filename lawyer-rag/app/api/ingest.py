"""
LawyerAI RAG System - Document Ingestion API Endpoints

Provides endpoints for:
- Ingesting new PDF documents into the vector store + knowledge graph
- Processing amendment acts with override logic
- Batch ingestion of all documents from the Acts directory
- File upload with rich metadata (admin document management)
"""

import os
import logging
import traceback
from pathlib import Path
from flask import Blueprint, request, jsonify

from app.config import config
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

logger = logging.getLogger(__name__)

ingest_bp = Blueprint("ingest", __name__)


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

            # Save uploaded file to data/uploads directory
            uploads_dir = Path(config.UPLOADS_DIR)
            uploads_dir.mkdir(parents=True, exist_ok=True)
            pdf_path = str(uploads_dir / file.filename)
            file.save(pdf_path)
            logger.info(f"Saved uploaded file to: {pdf_path}")

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

        if not Path(pdf_path).exists():
            return jsonify({"error": f"File not found: {pdf_path}"}), 404

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

        result = {
            "success": True,
            "message": f"Successfully ingested '{filename}'",
            "document_metadata": base_metadata,
            "pdf_info": pdf_info,
            "chunks_created": len(chunks),
            "chunks_added": chunks_added,
            "graph_stats": graph_stats,
        }

        logger.info(f"Ingestion complete: {result}")
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Ingestion error: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


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

        if not file.filename.lower().endswith(".pdf"):
            return jsonify({"error": "Only PDF files are supported"}), 400

        # Get required fields
        title = request.form.get("title", "").strip()
        category = request.form.get("category", "").strip()

        if not title:
            return jsonify({"error": "Document title is required"}), 400
        if not category:
            return jsonify({"error": "Document category is required"}), 400

        # Save file
        uploads_dir = Path(config.UPLOADS_DIR)
        uploads_dir.mkdir(parents=True, exist_ok=True)
        pdf_path = str(uploads_dir / file.filename)
        file.save(pdf_path)

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
            source_file=file.filename,
        )
        metadata["category"] = category
        metadata["description"] = request.form.get("description", "")
        metadata["court_name"] = request.form.get("court_name", "")
        metadata["case_number"] = request.form.get("case_number", "")
        metadata["gazette_number"] = request.form.get("gazette_number", "")

        # Get PDF info
        pdf_info = get_pdf_info(pdf_path)

        # Extract text
        full_text = extract_text_from_pdf(pdf_path)
        if not full_text.strip():
            return jsonify({"error": "Could not extract text from PDF"}), 400

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

        return jsonify({
            "success": True,
            "message": f"Successfully uploaded and ingested '{title}'",
            "document_name": title,
            "category": category,
            "pdf_info": pdf_info,
            "chunks_created": len(chunks),
            "chunks_added": chunks_added,
            "graph_stats": graph_stats,
        }), 200

    except Exception as e:
        logger.error(f"Upload ingestion error: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


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

            uploads_dir = Path(config.UPLOADS_DIR)
            uploads_dir.mkdir(parents=True, exist_ok=True)
            pdf_path = str(uploads_dir / file.filename)
            file.save(pdf_path)
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
        logger.error(f"Amendment processing error: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


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

        source_path = Path(source_dir)
        if not source_path.exists():
            return jsonify({"error": f"Source directory not found: {source_dir}"}), 404

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
                logger.error(f"Error processing {pdf_file.name}: {e}")
                results.append({
                    "file": pdf_file.name,
                    "status": "error",
                    "error": str(e),
                })

        return jsonify({
            "success": True,
            "message": f"Batch ingestion complete",
            "total_files_processed": len(pdf_files),
            "total_chunks_added": total_chunks,
            "details": results,
        }), 200

    except Exception as e:
        logger.error(f"Batch ingestion error: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500
