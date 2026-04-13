"""
LawyerAI RAG System - Smart Legal Document Chunker

This chunker understands the hierarchical structure of Sri Lankan legal documents:
  - Parts → Chapters → Sections → Subsections

It splits documents at section boundaries to preserve legal context integrity,
rather than using naive token-count splitting which would break mid-section.
"""

import re
from typing import Optional
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter


# ---------------------------------------------------------------------------
# Regex patterns for detecting legal structure markers
# ---------------------------------------------------------------------------

# Matches: "PART I", "PART II", "Part 1", "PART IV – GENERAL PROVISIONS", etc.
PART_PATTERN = re.compile(
    r"^[\s]*PART\s+[IVXLCDM\d]+[.\s\-–—]*.*$",
    re.IGNORECASE | re.MULTILINE,
)

# Matches: "CHAPTER I", "CHAPTER 3", "Chapter IV - Offences", etc.
CHAPTER_PATTERN = re.compile(
    r"^[\s]*CHAPTER\s+[IVXLCDM\d]+[.\s\-–—]*.*$",
    re.IGNORECASE | re.MULTILINE,
)

# Matches: "Section 14.", "14.", "Section 14 –", "14. (1)", "SECTION 14", etc.
# Also matches: "14A.", "14B." (amendment-style section numbers)
SECTION_PATTERN = re.compile(
    r"^[\s]*(?:(?:Section|SECTION|Sec\.?)\s*)?(\d+[A-Z]?)[\.\s]",
    re.MULTILINE,
)

# Matches: "(1)", "(2)", "(a)", "(b)", etc. — subsection markers
SUBSECTION_PATTERN = re.compile(
    r"^\s*\(\s*\d+\s*\)",
    re.MULTILINE,
)


def detect_current_part(text_before: str) -> Optional[str]:
    """Extract the last PART heading found before the current position."""
    matches = list(PART_PATTERN.finditer(text_before))
    if matches:
        return matches[-1].group(0).strip()
    return None


def detect_current_chapter(text_before: str) -> Optional[str]:
    """Extract the last CHAPTER heading found before the current position."""
    matches = list(CHAPTER_PATTERN.finditer(text_before))
    if matches:
        return matches[-1].group(0).strip()
    return None


def extract_section_number(text: str) -> Optional[str]:
    """Extract the section number from the beginning of a chunk."""
    match = SECTION_PATTERN.match(text.strip())
    if match:
        return f"Section {match.group(1)}"
    return None


def smart_legal_chunk(
    full_text: str,
    chunk_size: int = 1500,
    chunk_overlap: int = 200,
    metadata_base: Optional[dict] = None,
) -> list[Document]:
    """
    Split a legal document into semantically meaningful chunks.

    Strategy:
    1. First, split by section boundaries (Section X, CHAPTER X, PART X)
    2. If a section chunk is too large, sub-split with overlap
    3. Each chunk gets enriched metadata (part, chapter, section info)

    Args:
        full_text: The complete document text
        chunk_size: Maximum chunk size in characters
        chunk_overlap: Overlap between sub-chunks
        metadata_base: Base metadata to attach to every chunk

    Returns:
        List of LangChain Document objects with enriched metadata
    """
    if metadata_base is None:
        metadata_base = {}

    # -----------------------------------------------------------------------
    # Step 1: Split by major legal section boundaries
    # -----------------------------------------------------------------------
    # We use section markers as primary split points
    section_splits = re.split(
        r"(?=^[\s]*(?:(?:Section|SECTION|Sec\.?)\s*)?\d+[A-Z]?[\.\s])",
        full_text,
        flags=re.MULTILINE,
    )

    # Filter out empty splits
    section_splits = [s.strip() for s in section_splits if s.strip()]

    # If no section splits found (e.g., amendment documents), try chapter/part splits
    if len(section_splits) <= 1:
        section_splits = re.split(
            r"(?=^[\s]*(?:PART|CHAPTER)\s+[IVXLCDM\d]+)",
            full_text,
            flags=re.IGNORECASE | re.MULTILINE,
        )
        section_splits = [s.strip() for s in section_splits if s.strip()]

    # If still no splits, fall back to recursive character splitting
    if len(section_splits) <= 1:
        section_splits = [full_text]

    # -----------------------------------------------------------------------
    # Step 2: Process each section split
    # -----------------------------------------------------------------------
    documents = []
    fallback_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )

    # Track cumulative text for part/chapter detection
    cumulative_text = ""

    for i, section_text in enumerate(section_splits):
        # Detect current part and chapter from preceding text
        current_part = detect_current_part(cumulative_text + section_text)
        current_chapter = detect_current_chapter(cumulative_text + section_text)
        section_number = extract_section_number(section_text)

        # Build chunk metadata
        chunk_meta = {
            **metadata_base,
            "part": current_part or "Unknown",
            "chapter": current_chapter or "Unknown",
            "section_number": section_number or f"Chunk_{i+1}",
        }

        # If the section fits within chunk_size, keep it as one chunk
        if len(section_text) <= chunk_size:
            # Add context prefix for better retrieval
            context_prefix = ""
            if current_part and current_part != "Unknown":
                context_prefix += f"[{current_part}] "
            if current_chapter and current_chapter != "Unknown":
                context_prefix += f"[{current_chapter}] "

            doc = Document(
                page_content=context_prefix + section_text,
                metadata={
                    **chunk_meta,
                    "chunk_index": 0,
                    "total_sub_chunks": 1,
                },
            )
            documents.append(doc)
        else:
            # Section is too large — sub-split with overlap
            sub_chunks = fallback_splitter.split_text(section_text)
            for j, sub_text in enumerate(sub_chunks):
                # Add section context to each sub-chunk
                context_prefix = ""
                if section_number:
                    context_prefix = f"[{section_number}] "
                elif current_chapter and current_chapter != "Unknown":
                    context_prefix = f"[{current_chapter}] "

                doc = Document(
                    page_content=context_prefix + sub_text,
                    metadata={
                        **chunk_meta,
                        "chunk_index": j,
                        "total_sub_chunks": len(sub_chunks),
                    },
                )
                documents.append(doc)

        cumulative_text += section_text + "\n"

    return documents
