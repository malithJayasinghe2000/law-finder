"""
LawyerAI RAG System - Document Ingestion API Endpoints

Provides endpoints for:
- Ingesting new PDF documents into the vector store
- Processing amendment acts with override logic
- Batch ingestion of all documents from the Acts directory
"""

import os
import logging
import traceback
from pathlib import Path
from flask import Blueprint, request, jsonify

from app.config import config
from app.core.chunker import smart_legal_chunk
from app.core.vectorstore import add_documents, delete_document_by_name
from app.ingestion.pdf_parser import extract_text_from_pdf, get_pdf_info
from app.ingestion.metadata_builder import (
    build_metadata_from_filename,
    build_metadata_manual,
)
from app.ingestion.amendment_processor import process_amendment

logger = logging.getLogger(__name__)

ingest_bp = Blueprint("ingest", __name__)


@ingest_bp.route("/api/ingest", methods=["POST"])
def ingest_document():
    """
    Ingest a single PDF document into the vector store.

    Accepts either:
    1. A file upload (multipart/form-data with 'file' field)
    2. A JSON body with 'file_path' pointing to a local PDF

    Optional JSON/form fields for metadata overrides:
    - document_name: Override auto-detected document name
    - document_type: "Consolidated Act" or "Amendment Act"
    - status: "Active" or "Repealed"
    - last_updated_year: Override year
    """
    try:
        pdf_path = None
        metadata_overrides = {}

        # Check for file upload
        if "file" in request.files:
            file = request.files["file"]
            if file.filename == "":
                return jsonify({"error": "No file selected"}), 400

            # Save uploaded file to data/acts directory
            acts_dir = Path(config.ACTS_SOURCE_DIR)
            acts_dir.mkdir(parents=True, exist_ok=True)
            pdf_path = str(acts_dir / file.filename)
            file.save(pdf_path)
            logger.info(f"Saved uploaded file to: {pdf_path}")
        else:
            # Check for file_path in JSON body
            data = request.get_json(silent=True) or {}
            pdf_path = data.get("file_path")
            metadata_overrides = {
                k: v for k, v in data.items()
                if k in ("document_name", "document_type", "status", "last_updated_year", "act_number")
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

        result = {
            "success": True,
            "message": f"Successfully ingested '{filename}'",
            "document_metadata": base_metadata,
            "pdf_info": pdf_info,
            "chunks_created": len(chunks),
            "chunks_added": chunks_added,
        }

        logger.info(f"Ingestion complete: {result}")
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Ingestion error: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


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

            acts_dir = Path(config.ACTS_SOURCE_DIR)
            acts_dir.mkdir(parents=True, exist_ok=True)
            pdf_path = str(acts_dir / file.filename)
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

                results.append({
                    "file": filename,
                    "status": "success",
                    "document_name": base_metadata.get("document_name"),
                    "document_type": base_metadata.get("document_type"),
                    "chunks_created": len(chunks),
                    "chunks_added": chunks_added,
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
