"""
LawyerAI RAG System - PDF Parser

Extracts text from legal PDF documents using PyMuPDF (fitz).
Handles multi-column layouts, headers/footers, and page numbers.
"""

import logging
import re
from pathlib import Path

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)


# A marginal note and the section it heads sometimes share one text block:
#
#     "Default of defendant. 84. If the defendant fails to file his answer..."
#
# The Civil Procedure Code does this throughout. Left as one line, the section
# number is no longer at the start of a line, so the chunker's split pattern —
# which anchors to line starts — never fires, and section 84 stops existing as a
# citeable unit. Eleven Civil Procedure Code answer keys vanished this way.
#
# The note is matched deliberately tightly: it must start the block, contain no
# digits (headings do not), run no more than 90 characters, and be followed by
# something shaped like a section number. That keeps it from firing on an
# ordinary sentence that happens to precede an enumerated sub-paragraph.
# Two shapes, because the note does not always end in a full stop:
#
#   "Default of defendant. 84. If the defendant fails to file his answer..."
#   "Subscription of plaint 46.\n(1) Every plaint presented by a registered..."
#
# The first ends the note with a period, which is a strong enough signal on its
# own. The second does not, so it additionally requires the section number to
# sit at the END of the line — which is what makes it distinguishable from an
# ordinary sentence that happens to run into an enumerated amount ("...paid the
# sum of Rs. 500. 12. of the said amount" must not split).
#
# In both cases the note must start the block, begin with a capital, contain no
# digits, and run no more than 90 characters. Headings satisfy all four; prose
# generally does not.
_NOTE_THEN_SECTION_DOTTED = re.compile(
    r"^([A-Z][^0-9\n]{2,90}?\.)\s+(\d+[A-Z]?\.)",
)
# NOTE: the block text has already had its newlines collapsed to spaces by the
# caller, so "end of line" is not available as a signal here — the subsection
# marker that followed the number is. "Subscription of plaint 46.\n(1) Every
# plaint..." arrives as "Subscription of plaint 46. (1) Every plaint...", and it
# is the "(1)" that says 46 was a section number rather than a quantity. A
# capital letter straight after the dot counts too: this typesetting runs them
# together — "Necessary Parties 5.The plaintiff in a partition action shall
# include in his plaint as parties..." — and requiring a space there left
# Partition Law s.5 uncitable.
# Anchoring to `$` instead silently matched nothing, and the fix looked applied
# while eleven answer keys stayed broken.
_NOTE_THEN_SECTION_BARE = re.compile(
    r"^([A-Z][^0-9\n]{2,90}?)\s+(\d+[A-Z]?\.)(?=\s*$|\s*\(|[A-Z])",
    re.MULTILINE,
)


def _split_note_from_section(text: str) -> str:
    """Put a run-on marginal note on its own line, ahead of its section."""
    text = _NOTE_THEN_SECTION_DOTTED.sub(r"\1\n\2", text)
    return _NOTE_THEN_SECTION_BARE.sub(r"\1\n\2", text)


def _page_reading_order(page) -> str:
    """
    Extract one page in reading order, keeping marginal notes out of sentences.

    ── The problem this solves ──────────────────────────────────────────────
    These consolidated Acts are typeset in two columns: a narrow left column of
    MARGINAL NOTES (the side headings — "Enforceability of contract to purchase
    shares.", "Number of directors.") and a wide right column of body text.

    `page.get_text("text")` returns blocks in the PDF's internal order, which
    interleaves the two. The result is that a marginal note lands in the middle
    of a sentence, and everything downstream inherits the damage:

        "[Section 220] 220. (1) If at any time it appears to a director of a
         company that the net"                         <- body, cut off here
        "[PART XII WINDING UP] 297."                   <- a section number with
                                                          no body at all

    Both are real chunks from the corpus. A chunk containing only "297." is
    citeable and empty, which is the worst combination available: a model can
    cite it and a reader cannot tell it says nothing.

    ── How the columns are told apart ───────────────────────────────────────
    Geometrically, not by guessing. Body blocks are wide and start well to the
    right; marginal notes are narrow and sit hard against the left margin. The
    boundary is derived PER PAGE from the blocks themselves — the median left
    edge of the wide blocks — rather than hardcoded, because the margin differs
    between these documents and a fixed number would silently mis-split one of
    them.

    Notes are kept, not discarded. They are the section HEADINGS, and they are
    written in the vocabulary a layperson would search with ("Number of
    directors") where the body is in statutory language. They are emitted on
    their own line ahead of the body they head, so they help retrieval instead
    of corrupting it.

    Falls back to plain extraction when a page has no usable geometry, so a
    document that is not typeset this way is unaffected.
    """
    blocks = [b for b in page.get_text("blocks") if len(b) >= 5 and str(b[4]).strip()]
    if not blocks:
        return ""

    widths = [b[2] - b[0] for b in blocks]
    wide = [b for b, w in zip(blocks, widths) if w > 200]
    if len(wide) < 3:
        # Not a two-column page (a cover page, a schedule, a form). Use the
        # ordinary extractor rather than inventing a boundary from two blocks.
        return page.get_text("text")

    wide_left = sorted(b[0] for b in wide)
    body_left = wide_left[len(wide_left) // 2]
    # A note lies wholly to the LEFT of the body column. Both conditions matter:
    # narrow alone would catch a short body line, left-of alone would catch an
    # indented sub-paragraph.
    margin_cut = body_left - 20

    notes, body = [], []
    for b in sorted(blocks, key=lambda b: (round(b[1], 1), b[0])):
        text = " ".join(str(b[4]).split())
        if not text:
            continue
        # Both streams go through the splitter. The section number is sometimes
        # typeset inside the MARGINAL NOTE block rather than the body — the
        # Civil Procedure Code has "Subscription of plaint 46." as one note
        # block, with "(1) Every plaint presented..." as a separate body block.
        # Splitting only the body left those numbers buried mid-line, and five
        # Civil Procedure Code sections stayed uncitable through three attempts
        # at fixing this from the other end.
        text = _split_note_from_section(text)
        if b[0] < margin_cut and b[2] <= body_left + 40:
            notes.append((b[1], text))
        else:
            body.append((b[1], text))

    if not body:
        return page.get_text("text")

    # Interleave by vertical position: each note is emitted immediately before
    # the first body block at or below it, which is the section it heads.
    out, ni = [], 0
    for y, text in body:
        while ni < len(notes) and notes[ni][0] <= y + 2:
            out.append(notes[ni][1])
            ni += 1
        out.append(text)
    out.extend(text for _, text in notes[ni:])
    return "\n".join(out)


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
        text = _page_reading_order(page)

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
