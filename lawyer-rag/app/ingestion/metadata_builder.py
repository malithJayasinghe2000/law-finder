"""
LawyerAI RAG System - Metadata Builder

Builds rich metadata for legal document chunks based on filename patterns
and document content analysis. This metadata is critical for:
1. Distinguishing Active vs Repealed sections
2. Filtering by document type (Consolidated Act vs Amendment)
3. Identifying specific acts by name and year
"""

import re
import logging
from pathlib import Path
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Filename → Metadata mapping patterns
# ---------------------------------------------------------------------------
# Known document patterns based on Sri Lankan legal PDF naming conventions
DOCUMENT_PATTERNS = [
    {
        "pattern": re.compile(r"Consolidated[- ]?Civil[- ]?Procedure[- ]?Code.*?(\d{4})", re.IGNORECASE),
        "document_name": "Civil Procedure Code",
        "document_type": "Consolidated Act",
    },
    {
        "pattern": re.compile(r"Companies[- ]?Act[- ]?Consolidated.*?(\d{4})", re.IGNORECASE),
        "document_name": "Companies Act",
        "document_type": "Consolidated Act",
    },
    {
        "pattern": re.compile(r"Motor[- ]?Traffic[- ]?Consolidated.*?(\d{4})", re.IGNORECASE),
        "document_name": "Motor Traffic Act",
        "document_type": "Consolidated Act",
    },
    {
        "pattern": re.compile(r"Penal[- ]?Code[- ]?Consolidated.*?(\d{4})", re.IGNORECASE),
        "document_name": "Penal Code",
        "document_type": "Consolidated Act",
    },
    {
        "pattern": re.compile(r"Evidence[- ]?(?:Ordinance|Act)[- ]?Consolidated.*?(\d{4})", re.IGNORECASE),
        "document_name": "Evidence Ordinance",
        "document_type": "Consolidated Act",
    },
    # ── Land, property and conveyancing — added 2026-09-20 (roadmap 4.1) ──────
    #
    # Every name here is the statute's OWN short title, read out of section 1 of
    # the PDF ("This Ordinance may be cited as ..."), not inferred from the
    # filename. That matters because `document_name` is what a citation shows
    # the user and what `document_filter` matches on: a name nobody would type
    # is a section nobody can filter to, which is defect 4.12.
    #
    # Without these entries the fallback below produced "Partition  2024",
    # "Notaries  2024", "Registration Of Documents  2024" — eight of the nine.
    {
        "pattern": re.compile(r"Partition[- ]?Consolidated.*?(\d{4})", re.IGNORECASE),
        "document_name": "Partition Law",  # a Law, not an Act — Law No. 21 of 1977
        "document_type": "Consolidated Act",
    },
    {
        "pattern": re.compile(r"Prescription[- ]?Consolidated.*?(\d{4})", re.IGNORECASE),
        "document_name": "Prescription Ordinance",
        "document_type": "Consolidated Act",
    },
    {
        "pattern": re.compile(r"Prevention[- ]?of[- ]?Frauds[- ]?Consolidated.*?(\d{4})", re.IGNORECASE),
        "document_name": "Prevention of Frauds Ordinance",
        "document_type": "Consolidated Act",
    },
    {
        "pattern": re.compile(r"Registration[- ]?of[- ]?Documents[- ]?Consolidated.*?(\d{4})", re.IGNORECASE),
        "document_name": "Registration of Documents Ordinance",
        "document_type": "Consolidated Act",
    },
    {
        "pattern": re.compile(r"Notaries[- ]?Consolidated.*?(\d{4})", re.IGNORECASE),
        "document_name": "Notaries Ordinance",
        "document_type": "Consolidated Act",
    },
    {
        "pattern": re.compile(r"Powers[- ]?of[- ]?Attorney[- ]?Consolidated.*?(\d{4})", re.IGNORECASE),
        "document_name": "Powers of Attorney Ordinance",
        "document_type": "Consolidated Act",
    },
    {
        "pattern": re.compile(r"Land[- ]?Development[- ]?Consolidated.*?(\d{4})", re.IGNORECASE),
        "document_name": "Land Development Ordinance",
        "document_type": "Consolidated Act",
    },
    {
        # Filename drops the brackets the short title carries; keep them in the
        # name, because "Land (Restrictions on Alienation) Act" is how it is cited.
        "pattern": re.compile(r"Land[- ]?Restrictions[- ]?on[- ]?Alienation[- ]?Consolidated.*?(\d{4})", re.IGNORECASE),
        "document_name": "Land (Restrictions on Alienation) Act",
        "document_type": "Consolidated Act",
    },
    # Amendment act pattern: "24-2025_E.pdf" → Act No. 24 of 2025
    {
        "pattern": re.compile(r"^(\d+)-(\d{4})_[A-Z]", re.IGNORECASE),
        "document_name": None,  # Will be set dynamically
        "document_type": "Amendment Act",
    },
    # More general amendment pattern
    {
        "pattern": re.compile(r"^(\d+)-(\d{4})", re.IGNORECASE),
        "document_name": None,
        "document_type": "Amendment Act",
    },
]


def build_metadata_from_filename(filename: str) -> dict:
    """
    Build metadata from the PDF filename using known patterns.

    Args:
        filename: The PDF filename (e.g., "Consolidated-Civil-Procedure-Code-upto-Act-No.-43-of-2024.pdf")

    Returns:
        Metadata dict with document_name, document_type, status, etc.
    """
    stem = Path(filename).stem

    for entry in DOCUMENT_PATTERNS:
        match = entry["pattern"].search(stem)
        if match:
            groups = match.groups()

            if entry["document_type"] == "Amendment Act":
                # For amendment files like "24-2025_E.pdf"
                act_number = groups[0] if len(groups) > 0 else "Unknown"
                year = groups[1] if len(groups) > 1 else "Unknown"

                return {
                    "document_name": f"Act No. {act_number} of {year}",
                    "document_type": "Amendment Act",
                    "status": "Active",
                    "last_updated_year": int(year) if year.isdigit() else 0,
                    "act_number": f"Act No. {act_number} of {year}",
                    "source_file": filename,
                    "ingested_at": datetime.now(timezone.utc).isoformat(),
                }
            else:
                # For consolidated acts
                year = groups[0] if groups else "Unknown"

                return {
                    "document_name": entry["document_name"],
                    "document_type": entry["document_type"],
                    "status": "Active",
                    "last_updated_year": int(year) if year.isdigit() else 0,
                    "act_number": extract_act_number_from_filename(stem),
                    "source_file": filename,
                    "ingested_at": datetime.now(timezone.utc).isoformat(),
                }

    # Fallback: derive a readable name from the filename.
    #
    # ⚠️ A NAME DERIVED HERE IS A CITATION NOBODY CAN CHECK. `document_name` is
    # what the user is shown as the source and what `document_filter` matches
    # on, so a name that is not the statute's real short title is defect 4.12
    # in a new coat. Treat this warning as work to do, not as noise: add the
    # Act to DOCUMENT_PATTERNS above, with the short title read out of its own
    # section 1.
    logger.warning(
        "No pattern matched for %s — falling back to a name derived from the "
        "filename. Add it to DOCUMENT_PATTERNS with its statutory short title.",
        filename,
    )
    year_match = re.search(r"(\d{4})", stem)
    year = int(year_match.group(1)) if year_match else 0

    # Strip noise a TOKEN at a time. This used to be a list of substring
    # replacements including the bare letters "E", "S" and "T" — meant as the
    # language suffix in "24-2025_E", but `str.replace` does not know what a
    # suffix is, so it removed those letters from ANYWHERE in the name:
    #
    #   Trusts-Consolidated-2024          -> "rusts  2024"
    #   Estate-Duty-Consolidated-2024     -> "state Duty  2024"
    #   Stamp-Duty-Special-Provisions-…   -> "tamp Duty pecial Provisions  2024"
    #
    # All three are on the roadmap. Reproduced before it was changed.
    _NOISE = {"consolidated", "upto", "e", "s", "t"}
    tokens = [t for t in re.split(r"[-_\s]+", stem) if t]
    kept = []
    for i, tok in enumerate(tokens):
        if tok.lower() in _NOISE:
            continue
        if re.fullmatch(r"\d{4}", tok):  # a bare year, e.g. the "2024" suffix
            continue
        if tok.lower() in {"act", "no", "no."} and i and tokens[i - 1].lower() == "upto":
            continue
        # Title-case only what arrives lowercase, so "McCallum" survives intact.
        kept.append(tok.title() if tok.islower() else tok)
    readable_name = " ".join(kept).strip()

    return {
        "document_name": readable_name or stem,
        "document_type": "Consolidated Act" if "consolidated" in stem.lower() else "Act",
        "status": "Active",
        "last_updated_year": year,
        "act_number": extract_act_number_from_filename(stem),
        "source_file": filename,
        "ingested_at": datetime.now(timezone.utc).isoformat(),
    }


def extract_act_number_from_filename(filename_stem: str) -> str:
    """Extract act number from filename stem (e.g., 'Act-No.-43-of-2024' → 'Act No. 43 of 2024')."""
    match = re.search(r"Act[- ]?No\.?[- ]?(\d+)[- ]?of[- ]?(\d{4})", filename_stem, re.IGNORECASE)
    if match:
        return f"Act No. {match.group(1)} of {match.group(2)}"
    return "Unknown"


def build_metadata_manual(
    document_name: str,
    document_type: str = "Consolidated Act",
    status: str = "Active",
    last_updated_year: int = 2024,
    act_number: str = "Unknown",
    source_file: str = "manual_input",
) -> dict:
    """
    Build metadata manually for documents that don't follow standard naming.

    Args:
        document_name: Human-readable document name
        document_type: "Consolidated Act" or "Amendment Act"
        status: "Active" or "Repealed"
        last_updated_year: Year of last update
        act_number: Act number reference
        source_file: Source filename

    Returns:
        Metadata dict
    """
    return {
        "document_name": document_name,
        "document_type": document_type,
        "status": status,
        "last_updated_year": last_updated_year,
        "act_number": act_number,
        "source_file": source_file,
        "ingested_at": datetime.now(timezone.utc).isoformat(),
    }
