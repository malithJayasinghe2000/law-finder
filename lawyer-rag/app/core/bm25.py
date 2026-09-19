"""
BM25 keyword index over the corpus — the lexical half of hybrid retrieval.

WHY. Dense embeddings match meaning and are weak at matching *words*, and legal
questions are full of words that must match exactly: "Section 14(2)(b)",
"Act No. 24 of 2007", "incorporation", "resign". Three separate user reports in
one evening were all the same failure:

    "what is the process of company registration"   -> nothing found
    "what are the legal actions ... cut a tree"     -> nothing found
    "I want to resign from the company"             -> nothing found

and in each case the corpus held the answer under different wording. The
Companies Act says "incorporation" 108 times and "register a company" never; it
says "resign" 30 times, but about a *director* resigning, not "resigning from
the company". A synonym map was written to patch the first of those
(`synonyms.py`) and it fixes only the pairs somebody thought to write down.

BM25 needs no list. It scores documents by how well the user's own words match,
so "registration" finds the section that contains the word "registration"
whatever the embedding thinks.

WHAT THIS IS NOT. BM25 alone is a bad relevance judge for this product: a
question about land law will still match *some* chunk on a common word, and
returning it would undo the relevance floor that took `not_in_corpus` from 12.5%
to 100%. So this module only ever proposes CANDIDATES. Whether a candidate is
relevant enough to show is still decided by dense similarity against the same
`RETRIEVAL_MIN_SCORE` gate as before — see `hybrid_search` in vectorstore.py.

    BM25 decides what is *findable*. The floor still decides what is *relevant*.

THE ACTIVE FILTER IS NOT OPTIONAL. Only `status: Active` chunks are indexed. A
keyword search that surfaced a repealed section would be the worst failure this
service can produce — a confident statement of law that was repealed, correctly
cited to a section that really exists, which neither the model nor the citation
check can catch. `scripts/check_security.py` asserts the dense path never drops
that filter; this module never indexes anything else in the first place.
"""

import logging
import re
import threading

from rank_bm25 import BM25Okapi

from app.core.vectorstore import get_vectorstore

logger = logging.getLogger(__name__)

_index_lock = threading.Lock()
_index: "_Bm25Index | None" = None

# Words so common in legislation that matching on them is noise. Deliberately
# short: BM25 already discounts frequent terms via IDF, and an aggressive stop
# list removes words that carry real meaning in a statute ("may" and "shall" are
# not filler in legal drafting, they are the operative distinction).
_STOPWORDS = frozenset(
    "a an the of to in for on at by and or is are be been being that this it as "
    "with from into under over any such other than".split()
)


def _tokenise(text: str) -> list[str]:
    """
    Lowercase alphanumeric tokens.

    Section references break into their parts — "14(2)(b)" becomes
    ["14", "2", "b"] — which is imperfect but useful: a query for "section 14"
    still matches the chunk containing s.14, and the surrounding words carry the
    rest. Preserving the full reference as one token would make it matchable
    only by an exact-format query, which is rarer than the partial one.
    """
    return [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in _STOPWORDS]


class _Bm25Index:
    """An in-memory BM25 index over the Active chunks, with their Chroma ids."""

    def __init__(self, ids: list[str], metadatas: list[dict], corpus: list[list[str]]):
        self.ids = ids
        self.metadatas = metadatas
        self.bm25 = BM25Okapi(corpus)

    def search(
        self, query: str, n: int, document_filter: str | None = None
    ) -> list[str]:
        """Return up to `n` chunk ids, best first. Empty when the query has no usable terms."""
        tokens = _tokenise(query)
        if not tokens:
            return []

        scores = self.bm25.get_scores(tokens)
        order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)

        picked: list[str] = []
        for i in order:
            if scores[i] <= 0:
                break  # ranked, so everything after this is also zero
            if document_filter:
                name = str(self.metadatas[i].get("document_name") or "")
                if name.lower() != document_filter.lower():
                    continue
            picked.append(self.ids[i])
            if len(picked) >= n:
                break
        return picked


def get_bm25_index() -> "_Bm25Index | None":
    """
    Build (once) and return the index, or None if it cannot be built.

    Returns None rather than raising: BM25 is an enhancement to recall, and a
    service that refuses to answer because a keyword index failed to build would
    be trading a real capability for a hypothetical one. `hybrid_search` falls
    back to dense-only, which is exactly the behaviour that shipped before this
    module existed.
    """
    global _index
    if _index is not None:
        return _index

    with _index_lock:
        if _index is not None:  # another thread won the race
            return _index
        try:
            collection = get_vectorstore()._collection
            data = collection.get(
                where={"status": "Active"}, include=["documents", "metadatas"]
            )
            ids, docs, metas = data["ids"], data["documents"], data["metadatas"]
            if not ids:
                logger.warning("BM25: no Active chunks found; keyword search disabled")
                return None

            _index = _Bm25Index(ids, metas, [_tokenise(d or "") for d in docs])
            logger.info("BM25 index built over %d Active chunks", len(ids))
            return _index
        except Exception as e:
            logger.error("BM25 index could not be built (%s); dense-only retrieval", e)
            return None


def reset_bm25_index() -> None:
    """
    Drop the index so the next search rebuilds it.

    **Call this after any ingest or delete.** The index is a snapshot of the
    collection taken at first use; without this, a freshly ingested Act is
    findable by meaning and invisible to keyword search until the service is
    restarted — which is the kind of half-working state that takes a day to
    diagnose.
    """
    global _index
    with _index_lock:
        _index = None
    logger.info("BM25 index invalidated; it will rebuild on the next search")
