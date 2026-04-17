"""
LawyerAI RAG System - Amendment Processor

Handles the critical task of processing amendment acts that modify existing legislation.
When a 2025 amendment replaces Section 14 of a Consolidated Act:
1. Parse the amendment to identify affected sections
2. Mark old sections as "Repealed" in ChromaDB
3. Insert new amendment text as "Active"

This ensures the RAG system always retrieves the latest, correct version of the law.
"""

import re
import logging
from typing import Optional

from app.core.chunker import smart_legal_chunk
from app.core.vectorstore import (
    add_documents,
    update_chunk_status,
    get_all_document_names,
)
from app.ingestion.pdf_parser import extract_text_from_pdf
from app.ingestion.metadata_builder import build_metadata_from_filename

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Patterns for detecting amendment references
# ---------------------------------------------------------------------------

# "Section 14 of the principal act is hereby repealed and replaced"
REPEAL_REPLACE_PATTERN = re.compile(
    r"[Ss]ection\s+(\d+[A-Z]?)\s+of\s+(?:the\s+)?(?:principal\s+)?(?:[Aa]ct|[Oo]rdinance|[Cc]ode)"
    r".*?(?:repeal|replac|substitut|amend|insert|delet)",
    re.IGNORECASE | re.DOTALL,
)

# "Section 14 is amended by" or "In section 14,"
SECTION_AMENDMENT_PATTERN = re.compile(
    r"(?:[Ii]n\s+)?[Ss]ection\s+(\d+[A-Z]?)\s*(?:of|is|,)",
    re.IGNORECASE,
)

# "by the repeal of section 14 and the substitution therefor"
REPEAL_OF_SECTION_PATTERN = re.compile(
    r"repeal\s+of\s+[Ss]ection\s+(\d+[A-Z]?)",
    re.IGNORECASE,
)


def detect_affected_sections(amendment_text: str) -> list[str]:
    """
    Analyze amendment text to detect which sections of the principal act are affected.

    Args:
        amendment_text: Full text of the amendment act

    Returns:
        List of section numbers that are affected (e.g., ["Section 14", "Section 25"])
    """
    affected = set()

    # Pattern 1: "Section X of the principal act is repealed/replaced/amended"
    for match in REPEAL_REPLACE_PATTERN.finditer(amendment_text):
        affected.add(f"Section {match.group(1)}")

    # Pattern 2: "In section X," or "Section X is amended"
    for match in SECTION_AMENDMENT_PATTERN.finditer(amendment_text):
        affected.add(f"Section {match.group(1)}")

    # Pattern 3: "by the repeal of section X"
    for match in REPEAL_OF_SECTION_PATTERN.finditer(amendment_text):
        affected.add(f"Section {match.group(1)}")

    result = sorted(affected, key=lambda s: int(re.search(r"\d+", s).group()))
    logger.info(f"Detected {len(result)} affected sections: {result}")
    return result


def process_amendment(
    amendment_pdf_path: str,
    principal_act_name: str,
    metadata_overrides: Optional[dict] = None,
) -> dict:
    """
    Process an amendment act PDF:
    1. Extract text
    2. Detect affected sections
    3. Mark old sections as Repealed
    4. Ingest new amendment chunks as Active

    Args:
        amendment_pdf_path: Path to the amendment PDF
        principal_act_name: Name of the principal act being amended
            (e.g., "Civil Procedure Code")
        metadata_overrides: Optional metadata overrides

    Returns:
        Report dict with ingestion results
    """
    logger.info(f"Processing amendment: {amendment_pdf_path}")
    logger.info(f"Principal act: {principal_act_name}")

    # Step 1: Extract text
    amendment_text = extract_text_from_pdf(amendment_pdf_path)

    # Step 2: Detect affected sections
    affected_sections = detect_affected_sections(amendment_text)

    # Step 3: Mark old sections as Repealed
    sections_repealed = 0
    for section in affected_sections:
        count = update_chunk_status(
            document_name=principal_act_name,
            section_number=section,
            new_status="Repealed",
        )
        sections_repealed += count

    # Step 4: Build metadata for amendment chunks
    from pathlib import Path
    filename = Path(amendment_pdf_path).name
    base_metadata = build_metadata_from_filename(filename)
    base_metadata["status"] = "Active"
    base_metadata["amends"] = principal_act_name

    if metadata_overrides:
        base_metadata.update(metadata_overrides)

    # Step 5: Chunk and ingest the amendment document
    chunks = smart_legal_chunk(
        full_text=amendment_text,
        metadata_base=base_metadata,
    )

    chunks_added = add_documents(chunks)

    report = {
        "amendment_file": filename,
        "principal_act": principal_act_name,
        "affected_sections": affected_sections,
        "sections_repealed_count": sections_repealed,
        "new_chunks_added": chunks_added,
        "total_chunks_in_amendment": len(chunks),
    }

    logger.info(f"Amendment processing complete: {report}")
    return report
