import json
import re
import logging
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from app.core.llm import get_llm, message_text
from app.core.corpus import held_filter_names

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Smart Router Prompt — 6-intent classification + document filter
# ---------------------------------------------------------------------------
ROUTER_PROMPT = """You are an intent classifier for a legal AI assistant that specializes in Sri Lankan law.

Analyze the user's latest message (considering conversation history) and return a JSON object with two fields.

FIELD 1 — "intent" (required):
- "conversational": Greetings, thanks, acknowledgement, goodbye, small talk, or meta-questions about how the bot works.
- "clarification_needed": The user mentions a broad legal topic but does NOT ask a specific question or describe a specific situation. Examples: "I want legal advice about properties", "family law", "tell me about criminal law", "I need help with tax matters".
- "legal_query": A clear, specific, answerable legal question. Examples: "What is Section 14 of the Motor Traffic Act?", "What are the penalties for drunk driving?", "How do I file a civil case?"
- "follow_up": References the previous conversation. Examples: "what about that?", "explain the second point", "does this apply to minors?"
- "situation_report": The user describes a PERSONAL legal situation or problem. Examples: "someone cut a tree on my property without permission", "my employer fired me without notice", "I was in a road accident".
- "lawyer_request": The user explicitly asks for a lawyer or attorney. Examples: "recommend me a lawyer", "find me an attorney", "I want to talk to a lawyer".

CRITICAL DISTINCTIONS:
- "I need legal advice about X" → clarification_needed (NOT lawyer_request)
- "I need a lawyer for X" → lawyer_request
- "Someone did X to me, what can I do?" → situation_report
- "What does Section X say?" → legal_query

FIELD 2 — "document_filter" (required):
Pick the most relevant document from this list, or "All":
{document_filters}
- "All" — general, multiple areas, or uncertain

Use the EXACT name as written above. Anything else is discarded and treated as
"All". Prefer "All" whenever you are unsure — a wrong filter hides the answer,
whereas "All" merely searches wider.

RULES:
- Return ONLY a valid JSON object. No markdown, no explanation, no thinking.
- If intent is "conversational", "lawyer_request", or "clarification_needed", set document_filter to "All".
- Example: {{"intent": "legal_query", "document_filter": "Motor Traffic Act"}}
"""


def _router_prompt() -> str:
    """
    ROUTER_PROMPT with the document-filter menu filled in from the live store.

    Substituted with `str.replace` rather than by ChatPromptTemplate, on purpose.
    Act names are data, and some of them contain characters a template treats as
    syntax — "Land (Restrictions on Alienation) Act" is fine, but the moment a
    document name contained a brace it would become a template variable and
    raise at request time. Text that comes from the corpus must never be parsed
    as prompt syntax; that is the same principle as the injection fencing in
    rag_chain.format_context.
    """
    names = held_filter_names()
    if not names:
        menu = '- "All" — the document list could not be read; do not guess a filter'
    else:
        menu = "\n".join(f'- "{n}"' for n in names)
    return ROUTER_PROMPT.replace("{document_filters}", menu)


REWRITE_PROMPT = """You are a helpful assistant for a legal AI. 
Your task is to rewrite a follow-up question into a fully standalone legal question that can be understood without the conversation history.

Use the conversation history provided to figure out what the user is referring to. Replace any pronouns or ambiguous references (like "that", "it", "the first one") with the specific legal topic, law, or subject being discussed.

If the question is already clear, just return it as is.
Only return the rewritten question. Do NOT include any explanations or conversational text.

User's follow-up question: {question}
"""

CONVERSATIONAL_PROMPT = """You are LawyerAI, an expert legal assistant specialized in Sri Lankan law.
The user just sent a conversational message, greeting, acknowledgement, expressed confusion, or asked a meta-question about how you work.
Respond politely and concisely as an AI assistant. Do NOT provide legal advice or invent legal context.
If they say thanks, say you're welcome. If they say hello, ask how you can help them with Sri Lankan law today.
If they say they don't understand, politely apologize and ask them which specific part of the previous answer they would like you to clarify or explain in simpler terms.
If they ask how you verify information or whether they can trust you, tell them the truth and nothing more: your answers are drawn from a database of Sri Lankan legislation, every answer shows the Act and section it came from so they can check it themselves, and you are not a lawyer and cannot advise them on their own situation.
Never claim to verify or self-check your own citations. You do not. Overstating your reliability to someone deciding whether to rely on you is the worst thing you can do here.
"""

# The LLM practice-area extraction prompt was deleted in Phase 5. It classified
# what a person had written about their own legal problem so that matching
# attorneys could be displayed to them. See the note on lawyer_request below.

# ---------------------------------------------------------------------------
# Clarification topics — used when user's query is too vague
# ---------------------------------------------------------------------------
CLARIFICATION_TOPICS = {
    "property": {
        "area": "Property Law",
        "examples": [
            "how land ownership is transferred or disputed",
            "what the law says about buying or selling property",
            "what the law says about landlord and tenant",
            "what the law says about trespass or damage to property",
        ],
    },
    "properties": {
        "area": "Property Law",
        "examples": [
            "how land ownership is transferred or disputed",
            "what the law says about buying or selling property",
            "what the law says about landlord and tenant",
            "what the law says about trespass or damage to property",
        ],
    },
    "land": {
        "area": "Property Law",
        "examples": [
            "how land ownership is transferred or disputed",
            "what the law says about buying or selling property",
            "what the law says about landlord and tenant",
            "what the law says about trespass or damage to property",
        ],
    },
    "family": {
        "area": "Family Law",
        "examples": [
            "marriage or divorce proceedings",
            "child custody or maintenance",
            "adoption",
            "inheritance or succession",
        ],
    },
    "criminal": {
        "area": "Criminal Law",
        "examples": [
            "filing a police complaint",
            "understanding charges against you",
            "bail or arrest procedures",
            "criminal penalties for an offence",
        ],
    },
    "labour": {
        "area": "Labour / Employment Law",
        "examples": [
            "wrongful termination",
            "unpaid wages or overtime",
            "workplace harassment",
            "employment contract disputes",
        ],
    },
    "employ": {
        "area": "Labour / Employment Law",
        "examples": [
            "wrongful termination",
            "unpaid wages or overtime",
            "workplace harassment",
            "employment contract disputes",
        ],
    },
    "company": {
        "area": "Corporate Law",
        "examples": [
            "incorporating a company",
            "director or shareholder disputes",
            "corporate governance",
            "winding up a company",
        ],
    },
    "corporate": {
        "area": "Corporate Law",
        "examples": [
            "incorporating a company",
            "director or shareholder disputes",
            "corporate governance",
            "winding up a company",
        ],
    },
    "tax": {
        "area": "Tax Law",
        "examples": [
            "income tax obligations",
            "VAT or customs duties",
            "tax disputes or appeals",
            "tax compliance requirements",
        ],
    },
    "motor": {
        "area": "Motor Traffic Law",
        "examples": [
            "a road accident or collision",
            "traffic fines or licence issues",
            "drunk driving charges",
            "vehicle registration",
        ],
    },
    "traffic": {
        "area": "Motor Traffic Law",
        "examples": [
            "a road accident or collision",
            "traffic fines or licence issues",
            "drunk driving charges",
            "vehicle registration",
        ],
    },
    "insurance": {
        "area": "Insurance Law",
        "examples": [
            "a rejected insurance claim",
            "policy disputes",
            "third-party liability",
        ],
    },
    "immigration": {
        "area": "Immigration Law",
        "examples": [
            "visa applications or extensions",
            "citizenship matters",
            "deportation concerns",
        ],
    },
    "cyber": {
        "area": "Cyber / Computer Crimes",
        "examples": [
            "online fraud or identity theft",
            "hacking or unauthorized access",
            "digital evidence",
        ],
    },
}

# ---------------------------------------------------------------------------
# Fast heuristic phrases — these bypass the LLM entirely
# ---------------------------------------------------------------------------
CONVERSATIONAL_PHRASES = {
    "hi", "hello", "hey", "thanks", "thank you", "ok", "okay",
    "okay thanks", "got it", "good morning", "good evening",
    "bye", "goodbye", "cool", "awesome", "great", "nice",
    "i dont understand", "i cant understand", "what", "explain",
    "what do you mean", "can you explain", "i do not understand",
    "how you verify", "how do you verify", "are you sure",
    "how do you know", "is this correct", "can i trust this",
    "yes", "no", "sure", "yep", "nope", "yeah",
}

# ---------------------------------------------------------------------------
# Regex: ONLY matches EXPLICIT lawyer/attorney requests
# Deliberately excludes "legal advice", "consultation", "consulting"
# to prevent false positives like "I need legal advice about X"
# ---------------------------------------------------------------------------
LAWYER_REQUEST_REGEX = re.compile(
    r'\b(need|want|find|recommend|suggest|get|looking for|require|connect\s+me|show\s+me)\b'
    r'.*\b(lawyer|lawyers|attorney|attorneys|counsel|counsil)\b',
    re.IGNORECASE
)

# ---------------------------------------------------------------------------
# What we say when someone asks us to find them a lawyer
# ---------------------------------------------------------------------------
# The `lawyer_request` intent used to be the *most* helpful path in the system:
# it read the whole conversation, worked out which practice areas the person's
# problem fell into, and replied "Based on our conversation, I'd recommend
# consulting a Property Lawyer... I've found some matching lawyers on our
# platform below", with attorney cards underneath.
#
# That is the platform choosing a practitioner for someone on the basis of what
# they had just disclosed about their own legal problem. Touting under the
# Intermeddlers with Suitors Ordinance No. 11 of 1894 is a criminal offence and
# reaches the intermediary — and BASL's June 2021 note treats advice through an
# online platform as touting in the first place.
#
# The intent is kept only so the request can be recognised and declined. This is
# a fixed string, not a generated one: a refusal that a model composes is a
# refusal that a model can compose its way out of.
LAWYER_REQUEST_REFUSAL = (
    "I do not choose attorneys or firms, and I will not suggest one to you — not by name, "
    "not by type, and not based on what you have told me. Who advises you has to be your "
    "decision, made from neutral information rather than from a suggestion of mine.\n\n"
    "The directory lists every verified practice and practitioner alphabetically. Position in "
    "it cannot be bought, and nothing you have said here changes what you see. You can also "
    "approach any attorney-at-law directly, whether or not they are listed with us.\n\n"
    "If it helps, I am happy to explain what the law says on the subject you are dealing with."
)


# ═══════════════════════════════════════════════════════════════════════════
# Intent Classification
# ═══════════════════════════════════════════════════════════════════════════

def classify_intent(question: str, chat_history: list) -> dict:
    """
    Classifies the user query into one of 6 intents and determines the
    optimal document filter for vector search.

    Intent taxonomy:
      - conversational:       Greetings, thanks, meta-questions
      - clarification_needed: Vague topic mention without specifics
      - legal_query:          Clear, answerable legal question
      - follow_up:            References prior conversation context
      - situation_report:     Personal legal situation described
      - lawyer_request:       Explicit request for a lawyer/attorney

    Returns:
        dict with "intent" and "document_filter" keys
    """
    # ── Fast heuristic: conversational phrases ──────────────────────────
    clean_text = re.sub(r'[^a-zA-Z\s]', '', question.lower()).strip()
    if clean_text in CONVERSATIONAL_PHRASES:
        logger.info(f"Fast heuristic: '{clean_text}' -> conversational")
        return {"intent": "conversational", "document_filter": "All"}

    # ── Fast heuristic: explicit lawyer request ─────────────────────────
    if LAWYER_REQUEST_REGEX.search(question):
        logger.info(f"Fast heuristic: matched lawyer regex -> lawyer_request")
        return {"intent": "lawyer_request", "document_filter": "All"}

    # ── LLM-based routing ───────────────────────────────────────────────
    try:
        llm = get_llm()

        prompt = ChatPromptTemplate.from_messages([
            ("system", _router_prompt()),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{question}"),
        ])

        from app.core.rag_chain import convert_chat_history
        recent_history = chat_history[-4:] if chat_history else []
        langchain_history = convert_chat_history(recent_history)

        response = llm.invoke(prompt.invoke({
            "chat_history": langchain_history,
            "question": question,
        }))

        raw = message_text(response).strip()
        logger.info(f"Router raw output: {raw}")

        result = _parse_router_response(raw)

        # ── Guard: never clarify twice in a row ─────────────────────────
        # If the last bot message was already a clarification, the user
        # is now answering it. Escalate to follow_up so it goes to RAG.
        if result["intent"] == "clarification_needed" and chat_history:
            result = _guard_clarification_loop(result, chat_history)

        logger.info(f"Router parsed: intent={result['intent']}, filter={result['document_filter']}")
        return result

    except Exception as e:
        logger.error(f"Error classifying intent: {e}")
        return {"intent": "legal_query", "document_filter": "All"}


def _guard_clarification_loop(result: dict, chat_history: list) -> dict:
    """
    Prevent the bot from asking for clarification repeatedly.

    When the bot has already sent a clarification prompt (e.g., "could you tell me
    more about your specific situation?"), the user's next message is almost
    certainly an answer to that question — even if the LLM router thinks it's
    still vague. Override to 'follow_up' so it goes through the RAG pipeline.
    """
    CLARIFICATION_MARKERS = [
        "could you tell me more",
        "the more details you share",
        "the more specific you are",
        "could you tell me a bit more",
    ]

    for msg in reversed(chat_history):
        if msg.get("role") == "assistant":
            content = msg.get("content", "").lower()
            if any(marker in content for marker in CLARIFICATION_MARKERS):
                logger.info(
                    "Guard: already asked for clarification → "
                    "escalating to follow_up for RAG pipeline"
                )
                result["intent"] = "follow_up"
            break  # Only check the most recent bot message

    return result


VALID_INTENTS = {
    "conversational", "clarification_needed", "legal_query",
    "follow_up", "situation_report", "lawyer_request",
}


def _parse_router_response(raw: str) -> dict:
    """
    Robustly parse the LLM's JSON response, handling reasoning-model quirks
    like <think> tags, markdown fences, and extra text around JSON.
    """
    # Strip <think>...</think> tags from reasoning models
    cleaned = _strip_think_tags(raw)

    # Strip markdown code fences
    if cleaned.startswith("```"):
        cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
        cleaned = re.sub(r'\s*```$', '', cleaned)

    # Try to find a JSON object in the text
    json_match = re.search(r'\{[^{}]*\}', cleaned)
    if json_match:
        cleaned = json_match.group(0)

    try:
        parsed = json.loads(cleaned)
        intent = parsed.get("intent", "legal_query").lower().strip()
        doc_filter = parsed.get("document_filter", "All").strip()

        # Validate / fuzzy-match intent
        if intent not in VALID_INTENTS:
            if "conversational" in intent:
                intent = "conversational"
            elif "clarif" in intent:
                intent = "clarification_needed"
            elif "follow" in intent:
                intent = "follow_up"
            elif "situation" in intent:
                intent = "situation_report"
            elif "lawyer" in intent:
                intent = "lawyer_request"
            else:
                intent = "legal_query"

        # Validate document_filter against what is ACTUALLY in the store.
        #
        # This was a hardcoded set of four Acts plus "All". After the 2026-09-20
        # ingest the store held fourteen documents, so a correct filter like
        # "Penal Code" failed this check and was silently downgraded to "All" —
        # document filtering simply did not work for any Act added after the set
        # was written, and nothing said so. See app/core/corpus.py.
        valid_filters = set(held_filter_names()) | {"All"}
        if doc_filter not in valid_filters:
            if doc_filter and doc_filter != "All":
                logger.info(
                    "Router proposed document_filter=%r which is not a held document; using All",
                    doc_filter,
                )
            doc_filter = "All"

        return {"intent": intent, "document_filter": doc_filter}

    except (json.JSONDecodeError, AttributeError):
        logger.warning(f"Failed to parse router JSON, falling back: {cleaned}")
        lower = cleaned.lower()
        intent = "legal_query"
        if "conversational" in lower:
            intent = "conversational"
        elif "clarification" in lower:
            intent = "clarification_needed"
        elif "follow_up" in lower or "follow up" in lower:
            intent = "follow_up"
        elif "situation" in lower:
            intent = "situation_report"
        elif "lawyer" in lower:
            intent = "lawyer_request"

        return {"intent": intent, "document_filter": "All"}


# ═══════════════════════════════════════════════════════════════════════════
# Response Generators (non-RAG paths)
# ═══════════════════════════════════════════════════════════════════════════

def rewrite_query(question: str, chat_history: list) -> str:
    """Rewrites a follow-up query into a standalone query using history."""
    try:
        if not chat_history:
            return question

        llm = get_llm()

        prompt = ChatPromptTemplate.from_messages([
            ("system", REWRITE_PROMPT),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "Rewrite this question: {question}"),
        ])

        from app.core.rag_chain import convert_chat_history
        langchain_history = convert_chat_history(chat_history)

        response = llm.invoke(prompt.invoke({
            "chat_history": langchain_history,
            "question": question,
        }))

        rewritten = _strip_think_tags(message_text(response).strip())
        logger.info(f"Query rewritten: '{question}' -> '{rewritten}'")
        return rewritten

    except Exception as e:
        logger.error(f"Error rewriting query: {e}")
        return question


def generate_conversational_response(question: str, chat_history: list) -> str:
    """Generates a simple conversational response without RAG."""
    try:
        llm = get_llm()
        prompt = ChatPromptTemplate.from_messages([
            ("system", CONVERSATIONAL_PROMPT),
            ("human", "{question}"),
        ])

        response = llm.invoke(prompt.invoke({
            "question": question,
        }))

        return _strip_think_tags(message_text(response).strip())

    except Exception as e:
        logger.error(f"Error generating conversational response: {e}")
        return "Hello! How can I assist you with Sri Lankan law today?"


def generate_clarification_response(question: str, chat_history: list) -> dict:
    """
    Handle vague queries by asking the user to describe their specific situation.

    Instead of running a bad vector search on "I want legal advice about properties",
    this asks the user to be more specific — resulting in a much better follow-up search.

    Returns:
        Dict matching the standard query_rag return format.
    """
    question_lower = question.lower()

    # Try to detect which topic area the user mentioned
    detected_topic = None
    for keyword, topic_info in CLARIFICATION_TOPICS.items():
        if keyword in question_lower:
            detected_topic = topic_info
            break

    # Both branches ask for a sharper QUESTION. Neither asks for the person's
    # situation, and that is the whole point of the rewrite.
    #
    # This template used to open with "could you tell me more about your specific
    # situation?" and offer, as its worked example, *"my employer fired me
    # without notice"* — inviting the user to restate an answerable legal
    # question as an account of their own matter. That routes to
    # situation_report, which is the input this service handles worst
    # (RAG-REVIEW.md §4.10) and which the application then has to withhold under
    # rule 6 anyway. The clarification path was converting an answerable question
    # into an unanswerable one.
    #
    # The application's own refusal messages had this right all along: they offer
    # the general form — *"instead of 'what should I do about my landlord', try
    # 'what does Sri Lankan law say about a landlord ending a tenancy'"*. Same
    # move here.
    if detected_topic:
        area = detected_topic["area"]
        examples = detected_topic["examples"]
        examples_text = "\n".join(f"  • {ex}" for ex in examples)

        answer = (
            f"I can explain what Sri Lankan law says about **{area}** — I just need a "
            f"more specific question to look up.\n\n"
            f"Which of these is closest to what you want to know?\n{examples_text}\n\n"
            f"Ask it as a question about the law rather than about your own case, and "
            f"I can point you at the section that governs it."
        )
    else:
        answer = (
            "I can help, but I need a more specific question to look up.\n\n"
            "For example:\n"
            "  • *\"What does Section 151 of the Motor Traffic Act say?\"*\n"
            "  • *\"What does Sri Lankan law say about removing a company director?\"*\n"
            "  • *\"How is a civil action started in Sri Lanka?\"*\n\n"
            "Ask about the law rather than about your own situation — I can explain what "
            "the law says, but only an attorney-at-law who has taken you on as a client "
            "can advise you on your own case."
        )

    return {
        "answer": answer,
        "sources": [],
        "web_sources": [],
        "chunks_retrieved": 0,
        # Both branches above decline to advise on the asker's own case and
        # redirect to the general form of the question. Reported structurally so
        # a caller does not have to infer it from the prose — the evaluation
        # scorer had a growing list of phrase markers for exactly this, and a
        # marker list is a thing you tune until it agrees with you.
        "declined_advice": True,
        "detected_practice_areas": [],
        "graph_entities": [],
        "related_documents": [],
    }


# ═══════════════════════════════════════════════════════════════════════════
# Internal Helpers
# ═══════════════════════════════════════════════════════════════════════════

def _strip_think_tags(text: str) -> str:
    """Strip reasoning model's <think>...</think> tags from output."""
    cleaned = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
    return cleaned if cleaned else text
