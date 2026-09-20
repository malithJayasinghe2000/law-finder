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


# A body block that OPENS with a section marker. Kept deliberately in step with
# the chunker's split pattern in app/core/chunker.py — the whole point is that
# the two agree about where a section begins. A bare number must carry a dot,
# for the reason set out there (a cover page's "11 of 1887" is not a section).
_LEADING_SECTION_MARKER = re.compile(
    r"^[ \t]*(?:(?:Section|SECTION|Sec\.?)\s*\d+[A-Z]?[.\s]|\d+[A-Z]?\.)"
)


def _is_bare_marker(text: str) -> bool:
    """Is this line nothing but a section marker — "367.", "Section 46."?"""
    return bool(_LEADING_SECTION_MARKER.fullmatch(text.strip()))


def _markers_lead(pending: list[str]) -> list[str]:
    """Reorder a page's pending marginal notes so each section marker leads.

    The marker has to come out ahead of the note, because the chunker splits on
    the marker and whatever precedes it is filed with the PREVIOUS section.

    Three typesettings appear across these Acts, and all three reach here:

        "Punishment for theft.\\n367."   one block, already split upstream
        ["Punishment for theft.", "367."]   two separate note blocks
        "Incorporation of a company."       no marker; the body carries it

    Only an adjacent note/marker pair is swapped. A marker with no note before
    it, and a note with no marker after it, are both left exactly where they
    are — this must not reorder anything it does not understand.
    """
    flat: list[str] = []
    for note in pending:
        head, sep, tail = note.rpartition("\n")
        if sep and head.strip() and _is_bare_marker(tail):
            flat.extend([head.strip(), tail.strip()])
        else:
            flat.append(note)

    out: list[str] = []
    i = 0
    while i < len(flat):
        if (
            i + 1 < len(flat)
            and not _is_bare_marker(flat[i])
            and _is_bare_marker(flat[i + 1])
        ):
            out.extend([flat[i + 1].strip(), flat[i].strip()])
            i += 2
        else:
            out.append(flat[i])
            i += 1
    return out


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
    #
    # ── Why the section number is pulled out ahead of the note ──────────────
    #
    # Emitting the note *before* the body it heads is right on the page and was
    # wrong for everything downstream, because the CHUNKER splits on the section
    # marker — which comes after the note. So the boundary fell between the note
    # and its own section, and every marginal note in the corpus was filed with
    # the section BEFORE the one it belongs to:
    #
    #     ...or is an individual or a body corporate.     <- end of s.4
    #     Incorporation of a company.                     <- s.5's note
    #     5.(1) On receipt of a properly completed...     <- s.5 starts here
    #                    ^ the chunker split HERE
    #
    # 1,283 of 3,424 chunks (37.5%) ended with a note belonging to the next
    # section. The Penal Code is the clearest case: "Punishment for theft."
    # sat at the tail of s.365C — a chunk of illustrations of conduct that is
    # NOT theft — while s.367, which actually carries the punishment, ended
    # with "Theft of cattle.", the note for s.368.
    #
    # This matters more than a tidiness defect, because the marginal note is
    # the one place the statute uses the words a person would actually search
    # with. The body says "Whoever commits theft shall be punished with
    # imprisonment"; the note says "Punishment for theft", which is the query.
    # Measured against "What is the punishment for theft under the Sri Lankan
    # Penal Code?", cosine similarity of the s.367 text:
    #
    #     as stored, with the wrong note        0.7213
    #     body alone                            0.7221
    #     body with its own note and number     0.8002
    #
    # s.367 sat at dense rank 21 scoring 0.6059 — under the 0.62 floor, and out
    # of the top 30 altogether once fusion re-ranked it. The answer was in the
    # corpus, verbatim, and unreachable.
    #
    # So when a note is followed by a body block that opens with a section
    # marker, the marker is emitted FIRST, then the note, then the rest of the
    # body. The chunker's split boundary then falls ahead of the note and the
    # note stays with the section it heads. Pages that are not typeset this way
    # are untouched: no marker, no reordering.
    out, ni = [], 0
    for y, text in body:
        pending = []
        while ni < len(notes) and notes[ni][0] <= y + 2:
            pending.append(notes[ni][1])
            ni += 1
        if pending:
            # Two typesettings, and both have to end with the marker leading.
            #
            # (a) The number is in the NOTE block — "Punishment for theft. 367."
            #     — which `_split_note_from_section` has already broken onto two
            #     lines. The Penal Code is set this way throughout.
            # (b) The number is in the BODY block — "5.(1) On receipt of..." —
            #     as the Companies Act is.
            #
            # Handling only (b) fixed the Companies Act and left the Penal Code
            # exactly as it was, which is how the difference was noticed at all.
            pending = _markers_lead(pending)
            marker = _LEADING_SECTION_MARKER.match(text)
            if marker:
                out.append(text[:marker.end()].strip())
                out.extend(pending)
                rest = text[marker.end():].strip()
                if rest:
                    out.append(rest)
                continue
            out.extend(pending)
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
