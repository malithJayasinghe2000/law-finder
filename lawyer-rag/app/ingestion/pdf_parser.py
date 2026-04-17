"""
LawyerAI RAG System - PDF Parser

Extracts text from legal PDF documents using PyMuPDF (fitz).
Handles multi-column layouts, headers/footers, and page numbers.
"""

import logging
from pathlib import Path

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)


def extract_text_from_pdf(pdf_path: str | Path) -> str:
    """
    Extract clean text from a PDF file.

    Uses PyMuPDF for accurate text extraction with layout preservation.
    Removes common artifacts like page numbers, headers, and footers.

    Args:
        pdf_path: Path to the PDF file

    Returns:
        Cleaned extracted text
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    logger.info(f"Extracting text from: {pdf_path.name}")

    doc = fitz.open(str(pdf_path))
    all_text = []

    page_count = len(doc)
    for page_num in range(page_count):
        page = doc[page_num]
        text = page.get_text("text")

        # Basic cleaning
        text = clean_page_text(text, page_num + 1)
        if text.strip():
            all_text.append(text)

    doc.close()

    full_text = "\n\n".join(all_text)
    logger.info(
        f"Extracted {len(full_text)} characters from {page_count} pages: {pdf_path.name}"
    )

    return full_text


def clean_page_text(text: str, page_number: int) -> str:
    """
    Clean extracted page text by removing common artifacts.

    Args:
        text: Raw extracted text from a page
        page_number: The page number (1-indexed)

    Returns:
        Cleaned text
    """
    lines = text.split("\n")
    cleaned_lines = []

    for line in lines:
        stripped = line.strip()

        # Skip empty lines (but preserve paragraph breaks)
        if not stripped:
            if cleaned_lines and cleaned_lines[-1] != "":
                cleaned_lines.append("")
            continue

        # Skip likely page numbers (standalone numbers)
        if stripped.isdigit() and len(stripped) <= 4:
            continue

        # Skip common header/footer patterns in Sri Lankan legal PDFs
        if any(
            pattern in stripped.lower()
            for pattern in [
                "printed at the department of government printing",
                "gazette of the democratic socialist republic",
                "supplement to part ii of the gazette",
                "this act can be cited as",
                "© parliament of sri lanka",
            ]
        ):
            continue

        cleaned_lines.append(line)

    return "\n".join(cleaned_lines)


def get_pdf_info(pdf_path: str | Path) -> dict:
    """
    Get basic information about a PDF file.

    Args:
        pdf_path: Path to the PDF file

    Returns:
        Dict with page_count, file_size, filename
    """
    pdf_path = Path(pdf_path)
    doc = fitz.open(str(pdf_path))
    info = {
        "filename": pdf_path.name,
        "page_count": len(doc),
        "file_size_mb": round(pdf_path.stat().st_size / (1024 * 1024), 2),
    }
    doc.close()
    return info
