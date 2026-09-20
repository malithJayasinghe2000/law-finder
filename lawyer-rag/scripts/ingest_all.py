"""
Batch Ingestion Script - Ingest all PDFs from the Acts directory.

Usage:
    python -m scripts.ingest_all
    python -m scripts.ingest_all --clear  # Clear existing data first
"""

import sys
import argparse
import logging
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.utils.helpers import setup_logging
from app.config import config
from app.core.chunker import smart_legal_chunk
from app.core.vectorstore import (
    add_documents,
    get_collection_stats,
    get_vectorstore,
    _invalidate_keyword_index,
)
from app.ingestion.pdf_parser import extract_text_from_pdf, get_pdf_info
from app.ingestion.metadata_builder import build_metadata_from_filename

setup_logging("INFO")
logger = logging.getLogger(__name__)


def ingest_all(source_dir: str, clear_existing: bool = False, replace_existing: bool = False):
    """Ingest all PDF files from the source directory."""
    source_path = Path(source_dir)
    if not source_path.exists():
        logger.error(f"Source directory not found: {source_dir}")
        return

    pdf_files = sorted(source_path.glob("*.pdf"))
    if not pdf_files:
        logger.error(f"No PDF files found in {source_dir}")
        return

    logger.info(f"Found {len(pdf_files)} PDF files in {source_dir}")

    # Replace-in-place: delete only the documents we are about to re-ingest.
    #
    # `--clear` wipes the whole collection, which is wrong whenever the store
    # holds a document whose source PDF is not on disk. It holds one: the
    # Social Security Contribution Levy (Amendment) Act, No. 24 of 2025, whose
    # PDF could not be found on the publisher's site. Two evaluation questions
    # depend on it, and `--clear` would delete it with no way to put it back.
    if replace_existing:
        vs = get_vectorstore()
        collection = vs._collection
        for pdf_file in pdf_files:
            name = build_metadata_from_filename(pdf_file.name)["document_name"]
            existing = collection.get(where={"document_name": name})["ids"]
            if existing:
                collection.delete(ids=existing)
                logger.info(f"Replacing '{name}': removed {len(existing)} existing chunks")
        _invalidate_keyword_index()

    # Optionally clear existing data
    if clear_existing:
        logger.info("Clearing existing vector store data...")
        vs = get_vectorstore()
        collection = vs._collection
        all_ids = collection.get()["ids"]
        if all_ids:
            collection.delete(ids=all_ids)
            logger.info(f"Deleted {len(all_ids)} existing chunks")

    total_chunks = 0

    for pdf_file in pdf_files:
        logger.info(f"\n{'='*60}")
        logger.info(f"Processing: {pdf_file.name}")
        logger.info(f"{'='*60}")

        try:
            # Get PDF info
            info = get_pdf_info(pdf_file)
            logger.info(f"  Pages: {info['page_count']}, Size: {info['file_size_mb']} MB")

            # Build metadata
            metadata = build_metadata_from_filename(pdf_file.name)
            logger.info(f"  Document: {metadata['document_name']}")
            logger.info(f"  Type: {metadata['document_type']}")
            logger.info(f"  Year: {metadata['last_updated_year']}")

            # Extract text
            text = extract_text_from_pdf(str(pdf_file))
            logger.info(f"  Extracted: {len(text)} characters")

            if not text.strip():
                logger.warning(f"  SKIPPED: No text extracted")
                continue

            # Chunk
            chunks = smart_legal_chunk(
                full_text=text,
                chunk_size=config.CHUNK_SIZE,
                chunk_overlap=config.CHUNK_OVERLAP,
                metadata_base=metadata,
            )
            logger.info(f"  Chunks: {len(chunks)}")

            # Add to vector store
            added = add_documents(chunks)
            total_chunks += added
            logger.info(f"  Added to vector store: {added} chunks")

        except Exception as e:
            logger.error(f"  ERROR: {e}")
            continue

    # Print final stats
    stats = get_collection_stats()
    logger.info(f"\n{'='*60}")
    logger.info(f"INGESTION COMPLETE")
    logger.info(f"{'='*60}")
    logger.info(f"Total chunks added this run: {total_chunks}")
    logger.info(f"Total chunks in store: {stats['total_chunks']}")
    logger.info(f"Collection: {stats['collection_name']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Batch ingest legal PDFs")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete and re-ingest only the documents present in the source directory",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Clear existing data before ingesting",
    )
    parser.add_argument(
        "--source-dir",
        type=str,
        default=config.ACTS_SOURCE_DIR,
        help="Source directory containing PDFs",
    )
    args = parser.parse_args()

    ingest_all(
        source_dir=args.source_dir,
        clear_existing=args.clear,
        replace_existing=args.replace,
    )
