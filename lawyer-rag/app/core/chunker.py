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
#
# A BARE NUMBER MUST CARRY A DOT. "368." is a section; "368 " is not, and
# allowing the whitespace form made every line of a cover page's amending list
# into a section:
#
#     Ordinance Nos,
#     11 of 1887      -> "Section 11"
#     2 of 1883       -> "Section 2", a nine-character chunk reading "2 of 1883"
#
# The Penal Code's "Section 2" was exactly that, and it ranked in the top six
# for three different questions. The explicit "Section N" form keeps the looser
# spacing, because there the word does the disambiguating.
SECTION_PATTERN = re.compile(
    r"^[\s]*(?:(?:Section|SECTION|Sec\.?)\s*(\d+[A-Z]?)[\.\s]|(\d+[A-Z]?)\.)",
    re.MULTILINE,
)

# A four-digit number in the 1800-2100 range is a YEAR, not a section. The
# Computer Crime Act carried a chunk labelled "Section 1977" for this reason
# (RAG-REVIEW §4.13). No Sri Lankan Act has a section numbered in the thousands.
_YEAR_LIKE = re.compile(r"^(1[89]\d{2}|20\d{2}|2100)$")

# The amending-instrument list on a cover page: "11 of 1887", "13 of 2019".
_AMENDING_CITATION = re.compile(r"^\s*\d+\s+of\s+\d{4}\s*$", re.MULTILINE)

# Below this, a chunk carries no law on its own — it is a marginal note, a
# heading, or a fragment. Measured before the fix: 606 of 3,860 chunks (15.7%)
# were under 100 characters, and 184 were under 20. They waste a slot in a
# six-chunk context window, they match short queries well because they are
# short, and — unlike front matter — they carry a section number, so a model
# can CITE one. "Companies Act s.154" retrieved as the four words "Auditor's
# fees and expenses." is a citation that passes every check this system has.
MIN_CHUNK_CHARS = 250

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


def extract_section_number(text: str, *, scan_lines: int = 3) -> Optional[str]:
    """
    Extract the section number that opens a chunk.

    Scans the first few LINES rather than only the very first character,
    because a chunk legitimately begins with the section's marginal note:

        Subscription of plaint
        46. (1) Every plaint presented by a registered attorney...

    Matching only at position 0 returned None for every chunk of that shape, so
    the section number was replaced by a "Chunk_N" placeholder and five Civil
    Procedure Code sections became uncitable — while the heading that caused it
    was an improvement in every other respect.

    Kept to three lines, and each candidate must still sit at the start of its
    own line, so a sub-paragraph deep inside a section cannot be mistaken for
    the section itself.

    Returns None for anything that looks like a year, so that a cover-page
    citation cannot masquerade as a section.
    """
    match = None
    for line in text.strip().splitlines()[:scan_lines]:
        match = SECTION_PATTERN.match(line.strip())
        if match:
            break
    if not match:
        return None
    number = match.group(1) or match.group(2)
    if not number or _YEAR_LIKE.match(number):
        return None
    return f"Section {number}"



# Everything after a SCHEDULE heading is forms, tables and specimen documents,
# and they restate low numbers — "1.", "2.", "5." — which the section pattern
# cannot tell from real sections. In the Partition Law that produced eleven
# different chunks all labelled "Section 2", one of which was the operative
# provision and ten of which were blank form fields ("2..............."), and a
# citation to "Partition Law s.5" that resolved to "I have informed the parties
# present of the returnable date of this Commission."
#
# A schedule is not citeable as a section, so past this point no section number
# is assigned at all. The text stays searchable; it just stops pretending to be
# a section.
# CASE-SENSITIVE, deliberately. A real schedule heading is set in capitals
# ("SECOND SCHEDULE"); the word in ordinary prose is not. With IGNORECASE this
# matched "schedule of distribution has been approved by the court" — body text
# 50,000 characters before the actual schedules — and switched off section
# numbering for the entire second half of the Partition Law.
SCHEDULE_PATTERN = re.compile(
    r"^\s*(?:THE\s+)?(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH)?\s*SCHEDULES?\b",
    re.MULTILINE,
)

MAX_HEADING_CHARS = 300


def _merge_fragments(splits: list[str], chunk_size: int) -> list[tuple[str, str | None]]:
    """
    Attach unnumbered fragments to the section that follows, and say which
    section that is.

    Returns (text, section_number) pairs. Carrying the number out of here rather
    than re-deriving it from the merged text is the point: once a heading is
    glued on the front, the number is no longer the first thing in the chunk,
    and asking "what section does this text start with?" gives the wrong answer.

    ── Two rules, both learned by breaking answer keys ──────────────────────
    1. MERGE ONLY WHAT HAS NO NUMBER OF ITS OWN. An earlier version merged on
       LENGTH, and destroyed 13 of 80 answer keys: a genuinely short section
       (Prescription s.9 is one sentence) was swallowed by its neighbour and its
       number vanished. **The section number is the citation.**

    2. A HEADING IS SHORT. Pending text longer than MAX_HEADING_CHARS is not a
       heading — it is a cover page, a preamble or a schedule — and it is
       emitted on its own rather than glued to the next section. The Partition
       Law's cover page is 400+ characters and it absorbed section 2 whole,
       taking "Where any land belongs in common to two or more owners" out of
       every search for it.

    Text is never discarded; only chunk boundaries move. This runs before
    embedding, so anything dropped here would become unanswerable.
    """
    if not splits:
        return []

    out: list[tuple[str, str | None]] = []
    pending: list[str] = []

    def flush_pending() -> None:
        if pending:
            out.append(("\n".join(pending), None))
            pending.clear()

    in_schedule = False
    for part in splits:
        if SCHEDULE_PATTERN.search(part):
            in_schedule = True
        number = None if in_schedule else extract_section_number(part)
        if number:
            pending_text = "\n".join(pending)
            if pending and len(pending_text) <= MAX_HEADING_CHARS:
                out.append((f"{pending_text}\n{part}", number))
                pending.clear()
            else:
                flush_pending()
                out.append((part, number))
        else:
            pending.append(part)
            # Never let unnumbered text accumulate past one chunk's worth: a
            # preamble or a schedule can run for pages without a section number.
            if sum(len(x) for x in pending) >= chunk_size:
                flush_pending()

    flush_pending()
    return out


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
    # A bare number must be followed by a DOT to start a new section. Allowing
    # "\d+[A-Z]?[\.\s]" split on every line of the cover page's amending list
    # ("11 of 1887", "2 of 1883"), which is where the corpus's shortest and
    # least useful chunks came from.
    section_splits = re.split(
        r"(?=^[\s]*(?:(?:Section|SECTION|Sec\.?)\s*\d+[A-Z]?[\.\s]|\d+[A-Z]?\.))",
        full_text,
        flags=re.MULTILINE,
    )

    # Filter out empty splits
    section_splits = [s.strip() for s in section_splits if s.strip()]

    # Glue fragments back onto the text that follows them.
    #
    # Legal PDFs put marginal notes and side headings on their own lines, so a
    # split frequently yields "154." then "Auditor's fees and expenses." then
    # the body. Kept apart, the first two become citeable chunks containing no
    # law. Merged forward, the heading stays with the section it heads — which
    # is also better for retrieval, because the heading is often the words a
    # layperson would actually search for.
    section_splits = _merge_fragments(section_splits, chunk_size)

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

    # Carry the last PART/CHAPTER heading forward incrementally.
    #
    # This used to concatenate every split seen so far and re-scan the whole
    # accumulation with finditer on each iteration — O(n^2) in document length.
    # On the Civil Procedure Code (590,000 characters, ~800 splits) that is
    # roughly half a billion characters of regex scanning for one document, and
    # it got worse as the chunker was made to produce more splits. A heading
    # only ever needs to be found once, in the split that contains it.
    current_part = None
    current_chapter = None

    for i, (section_text, section_number) in enumerate(section_splits):
        current_part = detect_current_part(section_text) or current_part
        current_chapter = detect_current_chapter(section_text) or current_chapter

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

    return documents
