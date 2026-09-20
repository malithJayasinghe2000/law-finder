"""
What legislation this service actually holds — derived once, used everywhere.

WHY THIS MODULE EXISTS. The list of held Acts was written out by hand in four
places: both system prompts, the router's document-filter menu, and the router's
whitelist of acceptable filters. RAG-REVIEW §4.6 flagged that as drift waiting to
happen. On 2026-09-20 it happened, and it was not cosmetic:

    nine Acts of land, property and criminal law were ingested, and every one of
    those four places still named the original five.

The agent's system prompt told the model, in as many words, to refuse questions
about "Family Law, Property Law, Labour Law, Tax Law, Criminal Law" — while
retrieval was handing it the Penal Code and the Partition Law. Asked "what is
the punishment for theft under the Penal Code?", the service answered:

    "the Penal Code does not specifically address theft as a standalone offense"

which is false — s.366 defines theft and s.368 punishes it, and both were in the
corpus at the time. **Loading legislation without updating the prompt made the
service deny holding law it had just been given.**

So: one function, one cache, and an invalidation hook that ingestion calls. A
prompt that names the corpus must ask for it, not restate it.
"""

import logging
import threading
from typing import Optional

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_CACHE: Optional[list[str]] = None

# Display names for documents whose stored `document_name` is unusable.
#
# STOPGAP, and display-only. "Act No. 24 of 2007" is what
# build_metadata_from_filename derived from 24-2007_E.pdf; it is not a name
# anybody would ask for and not a citation anybody could look up
# (RAG-REVIEW.md §4.12). The real fix is to re-ingest those two with their long
# titles. This map never affects a citation — only what a prompt or a refusal
# message calls the Act.
DISPLAY_NAMES = {
    "Act No. 24 of 2007": "Computer Crime Act, No. 24 of 2007",
    "Act No. 24 of 2025": "Social Security Contribution Levy (Amendment) Act, No. 24 of 2025",
}


def held_legislation() -> list[str]:
    """
    Every document name in the store, display-mapped and sorted. Cached.

    Returns [] if the store cannot be read. Callers must treat an empty list as
    "unknown", never as "the corpus is empty" — the difference between those two
    is the whole of RAG-REVIEW §4.18, where a failed search was reported to a
    user as a statement about Sri Lankan law.
    """
    global _CACHE
    if _CACHE is not None:
        return _CACHE
    with _lock:
        if _CACHE is not None:
            return _CACHE
        try:
            from app.core.vectorstore import get_all_document_names

            names = [d.get("document_name", "") for d in get_all_document_names()]
            _CACHE = sorted({DISPLAY_NAMES.get(n, n) for n in names if n and n != "Unknown"})
            logger.info("Corpus list derived: %d documents", len(_CACHE))
            return _CACHE
        except Exception as e:
            logger.warning("Could not read corpus names (%s); prompts will omit the list", e)
            return []


def held_filter_names() -> list[str]:
    """
    The names a `document_filter` may legitimately take — the STORED names.

    Deliberately not display-mapped: a filter is matched against
    `document_name` in the metadata, so "Computer Crime Act, No. 24 of 2007"
    would match nothing. The prompt shows the display name; the whitelist takes
    the stored one; this function is the stored side.
    """
    try:
        from app.core.vectorstore import get_all_document_names

        return sorted(
            {
                str(d.get("document_name") or "")
                for d in get_all_document_names()
                if d.get("document_name") and d.get("document_name") != "Unknown"
            }
        )
    except Exception as e:
        logger.warning("Could not read corpus filter names (%s)", e)
        return []


def corpus_bullets() -> str:
    """The held legislation as a prompt-ready bullet list."""
    titles = held_legislation()
    if not titles:
        # Say nothing rather than something false. A prompt that names no Acts
        # degrades to "answer only from the context", which is still correct.
        return "- (the list could not be read; rely only on the retrieved context)"
    return "\n".join(f"- {t}" for t in titles)


def invalidate_corpus_cache() -> None:
    """
    Drop the cached list so the next prompt rebuilds it.

    **Call this after any ingest or delete**, exactly as `reset_bm25_index()` is
    called. Without it a freshly ingested Act is retrievable but the model is
    still told it does not exist, which is the half-working state this module
    was written to end.
    """
    global _CACHE
    with _lock:
        _CACHE = None
    logger.info("Corpus list invalidated; it will be re-derived on the next use")
