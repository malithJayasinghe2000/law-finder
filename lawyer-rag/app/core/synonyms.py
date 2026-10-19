"""
Lay wording → statutory wording, for retrieval only.

WHY THIS EXISTS. A user asked "what is the process of company registration" and
was told the service holds no legislation covering it. It holds the Companies
Act. Counted in the source PDF:

    incorporat…                108 occurrences
    "registration of a company"  1
    "company registration"       1
    "register a company"         0

**The statute says "incorporation". People say "registration".** Dense
embeddings bridge some of that, but not enough to clear RETRIEVAL_MIN_SCORE,
so the search returned nothing and the pipeline correctly reported that it
found nothing — about the single most ordinary question a person could ask a
Sri Lankan legal assistant.

This is the vocabulary-mismatch failure the roadmap names in Stage 2.4, and it
is well known in legal information retrieval: lay language and statutory
language are different registers describing the same thing.

WHAT THIS IS NOT. A patch, and a deliberately small one. It fixes the word
pairs written down here and nothing else, so the next phrasing nobody thought
of fails exactly as before. **The real fix is Stage 2.1 — hybrid search with
BM25** — which matches literal words without anyone maintaining a list, and
would have caught "registration" on the first try. When that lands, most of
this becomes redundant; keep whatever still earns its place and delete the rest.

HOW IT IS APPLIED. Only as a *rescue*: `rag_chain` searches the user's own
words first, and calls this only when nothing cleared the relevance floor. A
question that already retrieves is never touched, so this cannot degrade a
working query — it can only add a second attempt to one that already failed.

SCOPE. Every target term below is vocabulary from the five Acts actually held.
Do not add synonyms pointing at legislation that is not in the corpus: that
turns an honest "I do not hold that" into a search that still fails, just more
slowly. When the corpus grows, grow this with it.
"""

import re

# Lay phrasing -> statutory phrasing. Keys are matched case-insensitively on
# word boundaries; values are appended to the query, not substituted for it,
# because the user's own words may still carry signal.
#
# British spellings throughout: Sri Lankan legislation writes "unauthorised",
# "licence", "offence".
LAY_TO_STATUTORY: dict[str, tuple[str, ...]] = {
    # ── Companies Act ────────────────────────────────────────────────────
    "company registration": ("incorporation of a company",),
    "register a company": ("incorporation of a company",),
    "registering a company": ("incorporation of a company",),
    "registration of a company": ("incorporation of a company",),
    "start a company": ("incorporation of a company",),
    "starting a company": ("incorporation of a company",),
    "set up a company": ("incorporation of a company",),
    "open a company": ("incorporation of a company",),
    "form a company": ("incorporation of a company",),
    "new company": ("incorporation of a company",),
    "close a company": ("winding up", "liquidation"),
    "closing a company": ("winding up", "liquidation"),
    "shut down a company": ("winding up", "liquidation"),
    "company closure": ("winding up", "liquidation"),
    "board member": ("director",),
    "board members": ("directors",),
    "company owner": ("shareholder",),
    "company owners": ("shareholders",),
    "company rules": ("articles of association",),
    "annual report": ("annual return", "financial statements"),

    # ── Civil Procedure Code ─────────────────────────────────────────────
    "sue": ("institute action", "plaint"),
    "suing": ("institute action", "plaint"),
    "lawsuit": ("action", "plaint"),
    "file a case": ("institute action", "plaint"),
    "filing a case": ("institute action", "plaint"),
    "court case": ("action", "proceedings"),
    "take to court": ("institute action",),

    # ── DELIBERATELY ABSENT: divorce, inheritance, wills ─────────────────
    #
    # "divorce" -> "dissolution of marriage / matrimonial action" was here, and
    # it broke nic-001 ("What are the grounds for divorce in Sri Lanka?") on the
    # first run after this module was written — 17/17 not_in_corpus fell to
    # 16/17.
    #
    # The Civil Procedure Code holds matrimonial PROCEDURE (Chapter XLII) and
    # testamentary PROCEDURE (Chapter XXXVIII). It does not hold the substantive
    # law: the grounds for divorce, or what makes a will valid. Stage 1.1 found
    # this when two labels in the golden set turned out to be wrong, and added
    # questions on both sides so the set tests the LINE rather than one side of
    # it.
    #
    # Expanding "divorce" to the procedural vocabulary walks a substantive
    # question straight into procedural text that clears the relevance floor,
    # and the model then answers the grounds question from material about how to
    # file the case. That is worse than the refusal it replaced: confidently
    # wrong, correctly cited, and invisible to the citation gate.
    #
    # **The rule this violated is the one written at the top of this file:** do
    # not add a synonym whose target vocabulary exists for a different question
    # than the one being asked. Procedure and substance are different questions.
    # They become safe to add when the substantive law is actually in the corpus.

    # ── Motor Traffic Act ────────────────────────────────────────────────
    "car accident": ("accident", "motor vehicle"),
    "road accident": ("accident", "motor vehicle"),
    "crash": ("accident", "motor vehicle"),
    "driving license": ("driving licence",),
    "drivers license": ("driving licence",),
    "drunk driving": ("under the influence of drink", "incapable of having proper control"),

    # ── Penal Code: violence against a person (2026-10-19) ───────────────
    # "my husband hit me" and its follow-up "what legal action for this"
    # (rewritten "...a husband physically assaults or hits his wife") both
    # found nothing, while ss.310-329 ("hurt", "voluntarily causing hurt") and
    # s.343 ("assault") are in the Penal Code. Offence vocabulary only; the
    # domestic-violence ACT is not held, so nothing here points at it.
    "hit": ("voluntarily causing hurt", "assault"),
    "hits": ("voluntarily causing hurt", "assault"),
    "hitting": ("voluntarily causing hurt", "assault"),
    "beat": ("voluntarily causing hurt", "assault"),
    "beats": ("voluntarily causing hurt", "assault"),
    "beating": ("voluntarily causing hurt", "assault"),
    "beaten": ("voluntarily causing hurt", "assault"),
    "slapped": ("voluntarily causing hurt", "assault"),
    "punched": ("voluntarily causing hurt", "assault"),
    "kicked": ("voluntarily causing hurt", "assault"),
    "physically assaults": ("voluntarily causing hurt", "assault"),
    "stole": ("theft",),
    "stolen": ("theft", "stolen property"),

    # ── Computer Crimes Act ──────────────────────────────────────────────
    "hacking": ("unauthorised access", "computer crime"),
    "hacked": ("unauthorised access", "computer crime"),
    "hacker": ("unauthorised access", "computer crime"),
    "cyber crime": ("computer crime",),
    "cybercrime": ("computer crime",),
}

# Longest keys first, so "register a company" wins over any shorter key that
# happens to be a substring of it.
_PATTERNS: list[tuple[re.Pattern, tuple[str, ...]]] = [
    (re.compile(r"\b" + re.escape(lay) + r"\b", re.IGNORECASE), statutory)
    for lay, statutory in sorted(
        LAY_TO_STATUTORY.items(), key=lambda kv: len(kv[0]), reverse=True
    )
]


def expand_query(question: str) -> str | None:
    """
    Add statutory wording for any lay phrasing found in the question.

    Returns the expanded query, or **None** when nothing matched — so the caller
    can tell "no expansion available" from "expanded but still found nothing",
    and skip a second search that would be identical to the first.

    The user's own words are kept. The statutory terms are appended, because a
    question is more than its vocabulary and replacing wholesale would throw
    away the part the embedding got right.
    """
    if not question:
        return None

    added: list[str] = []
    for pattern, statutory in _PATTERNS:
        if pattern.search(question):
            for term in statutory:
                if term not in added and term.lower() not in question.lower():
                    added.append(term)

    if not added:
        return None
    return f"{question} {' '.join(added)}"
