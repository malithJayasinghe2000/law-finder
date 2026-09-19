"""
LawyerAI RAG System — the chat model, built in one place.

WHICH MODEL ANSWERS A LEGAL QUESTION is decided by two settings and nowhere
else: `config.LLM_PROVIDER` picks the client, `config.LLM_MODEL` names the
model. Do NOT write a model name into this docstring, a README, a script or a
second config file. The previous docstring said one model while config defaulted
to a second, `.env` ran a third and `.env.example` and the README named a
fourth — five files, four answers, and no way to tell which one a user's
question actually reached. Settling that was Stage 1.6; keeping it settled means
the name lives in `.env` and is read by `config.py`.

Two providers, and the difference between them is not only answer quality.

  ollama      Local inference. The question never leaves the machine. This is
              the development path, and it is the only path that raises no
              data-protection question at all.

  google      Hosted inference. **The full text of every question leaves Sri
              Lanka.** That is the same shape of transfer as the LangSmith leak
              Stage 0 closed, with one difference that matters: a tracing
              vendor received the data for observability nobody needed, whereas
              a model provider receives it because there is no assistant
              without it. Necessary is not the same as lawful — see the
              preconditions in `_build_google` below, and OPEN-ITEMS A4.

Everything downstream uses only `invoke()` and `bind_tools()`, which are
LangChain's provider-independent surface, so the pipeline does not know or care
which branch built the client.
"""

import logging

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_ollama import ChatOllama

from app.config import config

logger = logging.getLogger(__name__)

_llm_instance: BaseChatModel | None = None


def _build_ollama() -> ChatOllama:
    """
    Local inference.

    num_ctx and num_predict are the two bounds that were missing, and both are
    Ollama-specific in a way that matters:

      num_ctx      was 8192, and the agent pipeline does not fit in 8192. Ollama
                   truncates silently on overflow, so the system prompt carrying
                   "you never advise a person about their own case" was among
                   the things that could vanish without a log line. Now 32768.

      num_predict  did not exist, so generation was unbounded. A model that
                   began repeating itself ran until the caller's 60s timeout.
    """
    return ChatOllama(
        model=config.LLM_MODEL,
        base_url=config.OLLAMA_BASE_URL,
        temperature=config.LLM_TEMPERATURE,
        top_p=config.LLM_TOP_P,
        num_ctx=config.LLM_NUM_CTX,
        num_predict=config.LLM_NUM_PREDICT,
    )


def _build_google() -> BaseChatModel:
    """
    Hosted inference (Google Generative Language API).

    ⚠ UNTESTED AS OF STAGE 1.6. No key existed when this was written, so this
    branch has never answered a question and the model has never been measured
    against eval/questions.yaml. Do not describe Stage 1.6 as having compared a
    hosted model until somebody has actually run it. Building the seam is not
    the same as measuring the candidate, and this project has been bitten
    before by work that existed with no caller.

    ── Before you point this at anything a real person can reach ──────────────
    Enabling a hosted provider sends the text of every question — which can
    carry the facts of somebody's legal problem — to a processor outside Sri
    Lanka. Four things have to be true first, and none of them is code:

      1. **Check which Gemini tier the key is on.** Google's free API tier is
         documented as using submitted prompts to improve its products; the
         paid tier is not. A free key therefore risks the text of Sri Lankan
         legal questions becoming training data, which is a worse outcome than
         the LangSmith leak Stage 0 closed — that was retention by a vendor,
         this would be absorption into a model. Verify the current terms
         against the key in use; do not assume from this comment.
      2. The cross-border transfer has a documented basis (PDPA; OPEN-ITEMS A4,
         counsel question 19). Unresolved today.
      3. The provider is recorded as a sub-processor in
         lawyer-finder-web/docs/restructure/DATA-INVENTORY.md and disclosed in
         the published privacy notice. A firm cannot consent to a processor it
         was never told about. Note that this product already uses Google for
         OAuth sign-in and Maps — that does NOT carry over. An email address
         for a login and the facts of a legal problem are different data for a
         different purpose, and the second needs its own basis.
      4. The provider's retention period for API inputs is known.

    Running the evaluation set through it is a different matter and is fine:
    eval/questions.yaml is 83 authored test questions and contains no real
    person's data. Measuring a candidate is not deploying it.

    ── Why there is no num_ctx here ──────────────────────────────────────────
    There is no analogue and it is not an omission. `num_ctx` exists in the
    Ollama branch because Ollama silently truncates a context it cannot fit,
    which is how a safety instruction disappears without a log line. A hosted
    API has a fixed context window and returns an ERROR when a request exceeds
    it. A loud failure needs no guard; a silent one does. `max_output_tokens` is
    the real counterpart of `num_predict` and is set from the same config value,
    so the generation cap stays one number across both providers.

    ── The two defaults that had to be overridden ────────────────────────────
    `temperature` defaults to 0.7 and this system wants 0.1 — a legal answer
    should be close to deterministic. `max_retries` defaults to SIX, which
    against LLM_TIMEOUT_SECONDS could spend many minutes on a request the
    Next.js caller abandoned at 60 seconds.

    ── A risk worth measuring, not assuming ──────────────────────────────────
    Gemini applies content safety filters that Ollama does not. A legal corpus
    is full of exactly the vocabulary those filters watch for — the Computer
    Crimes Act describes offences, the Civil Procedure Code describes seizure
    and arrest. A filter that blocks such an answer returns an empty or
    truncated response, which this pipeline would surface as a failure to
    answer rather than as a refusal. `safety_settings` is deliberately left at
    the default so that the first measurement shows the real behaviour; if it
    turns out to block legitimate legal questions, that is a finding to record
    and then tune, not something to pre-emptively switch off unseen.
    """
    from langchain_google_genai import (  # imported lazily: optional dep
        ChatGoogleGenerativeAI,
    )

    if not config.GOOGLE_API_KEY:
        raise RuntimeError(
            "LLM_PROVIDER=google but GOOGLE_API_KEY is not set. Put it in "
            "lawyer-rag/.env. Note this is a Generative Language API key, which "
            "is NOT the same credential as the Google OAuth or Maps keys in "
            "lawyer-finder-web/.env. If you meant to run locally, set "
            "LLM_PROVIDER=ollama."
        )

    logger.warning(
        "Hosted inference is ENABLED (provider=%s, model=%s). The text of every "
        "question now leaves Sri Lanka. This is a cross-border transfer of "
        "personal data with no documented basis (OPEN-ITEMS A4 / counsel Q19), "
        "and the provider is not yet recorded as a sub-processor. Confirm the "
        "API key is NOT on a free tier that trains on submitted prompts. "
        "Acceptable for evaluation against eval/questions.yaml, which holds no "
        "real person's data; not acceptable for real users until those close.",
        config.LLM_PROVIDER,
        config.LLM_MODEL,
    )

    return ChatGoogleGenerativeAI(
        model=config.LLM_MODEL,
        google_api_key=config.GOOGLE_API_KEY,
        temperature=config.LLM_TEMPERATURE,
        top_p=config.LLM_TOP_P,
        max_output_tokens=config.LLM_NUM_PREDICT,
        # The Next.js caller gives up at 60s and gunicorn's worker at 120s. A
        # client that waits longer than either waits for a reply nobody wants.
        timeout=config.LLM_TIMEOUT_SECONDS,
        # Default is SIX. Each retry is a fresh round trip against the same
        # deadline, so the defaults together can burn many times the caller's
        # whole budget and return nothing. One retry absorbs a blip; more only
        # hides an outage behind a timeout.
        max_retries=1,
    )


# Adding a provider is adding an entry here and a _build_* function. Keep the
# key identical to the LLM_PROVIDER value, and add it to _VALID_LLM_PROVIDERS in
# config.py so a typo fails at startup rather than on a user's question.
_BUILDERS = {
    "ollama": _build_ollama,
    "google": _build_google,
}


def get_llm() -> BaseChatModel:
    """Get or create the singleton chat model for the configured provider."""
    global _llm_instance
    if _llm_instance is None:
        builder = _BUILDERS.get(config.LLM_PROVIDER)
        if builder is None:
            raise RuntimeError(
                f"LLM_PROVIDER={config.LLM_PROVIDER!r} is not a provider this "
                f"service knows. Valid values: {', '.join(sorted(_BUILDERS))}."
            )
        _llm_instance = builder()
        logger.info(
            "LLM ready: provider=%s model=%s", config.LLM_PROVIDER, config.LLM_MODEL
        )
    return _llm_instance


def message_text(response) -> str:
    """
    The text of a model reply, as a string, whatever shape the provider used.

    **Never read `.content` directly.** Ollama returns a plain string; Gemini 3.x
    returns a LIST of content blocks — text alongside reasoning blocks carrying
    opaque `signature` payloads. Both are valid LangChain, and code that assumes
    the first breaks silently on the second:

      - `response.content.strip()` raises AttributeError on a list. In
        `query_router` that is caught by a broad `except`, which then returns the
        DEFAULT intent — so routing silently stopped working rather than failing.
      - `rag_chain` assigned the list straight to `answer`, so `/api/chat`
        returned a JSON array where every caller expects a string. The Next.js
        side fails closed (`typeof payload.answer === 'string' ? … : ''`), so the
        user got an EMPTY answer for every question. Nothing logged an error.

    Measured on `gemini-3.6-flash`, 2026-09-19, before this helper existed.

    `.text` is LangChain's own accessor and concatenates the text blocks,
    dropping reasoning and tool-call blocks — which is exactly what we want,
    since a reasoning trace is not an answer and must never reach a user.
    """
    text = getattr(response, "text", None)
    if text is not None:
        # `.text` migrated from a method to a property; the transitional
        # TextAccessor is both, so this works either way without a deprecation
        # warning path we would have to chase on the next upgrade.
        return str(text() if callable(text) else text)

    content = getattr(response, "content", response)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            block.get("text", "")
            for block in content
            if isinstance(block, dict) and block.get("type") == "text"
        )
    return str(content)


def reset_llm() -> None:
    """
    Drop the cached client so the next get_llm() rebuilds it.

    Only for tests and for scripts that change the configuration in-process.
    The service itself builds the client once per worker and keeps it.
    """
    global _llm_instance
    _llm_instance = None
