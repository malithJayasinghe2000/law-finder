import json
import re
import logging
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from app.core.llm import get_llm

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
Pick the most relevant document or "All":
- "Motor Traffic Act" — driving, vehicles, road accidents, traffic offences
- "Companies Act" — companies, directors, shareholders, incorporation
- "Civil Procedure Code" — court procedures, filing cases, appeals, evidence
- "Act No. 24 of 2007" — computer crimes, cyber offences, hacking
- "All" — general, multiple areas, or uncertain

RULES:
- Return ONLY a valid JSON object. No markdown, no explanation, no thinking.
- If intent is "conversational", "lawyer_request", or "clarification_needed", set document_filter to "All".
- Example: {{"intent": "legal_query", "document_filter": "Motor Traffic Act"}}
"""

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
If they ask how you verify information or if they can trust you, explain that you retrieve answers directly from a verified vector database of Sri Lankan legislation and use an internal verification tool to self-check citations before answering, but they should always consult a human lawyer for official advice.
"""

# ---------------------------------------------------------------------------
# LLM-based practice area extraction for lawyer recommendations
# ---------------------------------------------------------------------------
LAWYER_AREA_EXTRACTION_PROMPT = """You are a legal classification assistant. Analyze the conversation below and identify which practice areas are most relevant to the user's legal situation.

Choose ONLY from this list:
- Criminal Law
- Civil Litigation
- Corporate Law
- Family Law
- Property Law
- Labour Law
- Tax Law
- Constitutional Law
- Environmental Law
- Intellectual Property
- Motor Traffic Law
- Banking Law
- Immigration Law
- Insurance Law
- Real Estate
- Notary Services

RULES:
- Pick 1 to 3 areas that BEST match the user's actual legal situation, not just keywords.
- Consider the legal advice already given in the conversation to determine the correct areas.
- "Real Estate" is for property transactions (buying, selling, conveyancing), NOT for property damage or trespass disputes.
- Return ONLY a valid JSON array of strings. No markdown, no explanation, no thinking.
- Example: ["Property Law", "Civil Litigation"]
"""

# ---------------------------------------------------------------------------
# Clarification topics — used when user's query is too vague
# ---------------------------------------------------------------------------
CLARIFICATION_TOPICS = {
    "property": {
        "area": "Property Law",
        "examples": [
            "a land boundary or ownership dispute",
            "buying, selling, or transferring property",
            "a tenant or landlord issue",
            "trespassing or property damage",
        ],
    },
    "properties": {
        "area": "Property Law",
        "examples": [
            "a land boundary or ownership dispute",
            "buying, selling, or transferring property",
            "a tenant or landlord issue",
            "trespassing or property damage",
        ],
    },
    "land": {
        "area": "Property Law",
        "examples": [
            "a land boundary or ownership dispute",
            "buying, selling, or transferring property",
            "a tenant or landlord issue",
            "trespassing or property damage",
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
            ("system", ROUTER_PROMPT),
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

        raw = response.content.strip()
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

        # Validate document_filter
        valid_filters = {
            "Motor Traffic Act", "Companies Act",
            "Civil Procedure Code", "Act No. 24 of 2007", "All",
        }
        if doc_filter not in valid_filters:
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

        rewritten = _strip_think_tags(response.content.strip())
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

        return _strip_think_tags(response.content.strip())

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

    if detected_topic:
        area = detected_topic["area"]
        examples = detected_topic["examples"]
        examples_text = "\n".join(f"  • {ex}" for ex in examples)

        answer = (
            f"I can help you with **{area}** matters! To give you the most relevant information, "
            f"could you tell me more about your specific situation?\n\n"
            f"For example, are you dealing with:\n{examples_text}\n\n"
            f"The more details you share, the better I can assist you."
        )
    else:
        answer = (
            "I'd be happy to help! Could you tell me a bit more about your specific legal "
            "situation or question?\n\n"
            "For example:\n"
            "  • Describe a situation you're facing (e.g., *\"my employer fired me without notice\"*)\n"
            "  • Ask about a specific law (e.g., *\"What does Section 14 of the Motor Traffic Act say?\"*)\n"
            "  • Ask about a legal procedure (e.g., *\"How do I file a civil case in Sri Lanka?\"*)\n\n"
            "The more specific you are, the better I can help you."
        )

    return {
        "answer": answer,
        "sources": [],
        "web_sources": [],
        "chunks_retrieved": 0,
        "detected_practice_areas": [],
        "graph_entities": [],
        "related_documents": [],
    }


def generate_lawyer_response(question: str, chat_history: list) -> dict:
    """
    Handle explicit lawyer recommendation requests by extracting practice areas
    from the full conversation context and generating a natural bridging response.

    Returns:
        Dict matching the standard query_rag return format.
    """
    from app.core.rag_chain import detect_practice_areas

    # Build full conversation context (both user AND bot messages)
    conversation_text_parts = []
    for msg in (chat_history or [])[-8:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        conversation_text_parts.append(f"{role.upper()}: {content}")
    conversation_text_parts.append(f"USER: {question}")
    conversation_text = "\n\n".join(conversation_text_parts)

    # LLM-based practice area extraction (uses full context including bot replies)
    detected_areas = _extract_practice_areas_llm(conversation_text)
    logger.info(f"[lawyer_response] LLM detected areas: {detected_areas}")

    # Fallback to keyword-based detection if LLM returns nothing
    if not detected_areas:
        user_history_text = " ".join(
            msg.get("content", "")
            for msg in (chat_history or [])[-8:]
            if msg.get("role") == "user"
        )
        combined_context = f"{question} {user_history_text}"
        detected_areas = detect_practice_areas(combined_context, combined_context)
        logger.info(f"[lawyer_response] Keyword fallback areas: {detected_areas}")

    if not detected_areas:
        return {
            "answer": (
                "I'd be happy to help you find the right type of lawyer! "
                "Could you briefly describe your legal situation or the topic you need help with? "
                "For example: a road accident, a property dispute, an employment issue, etc. "
                "This will help me recommend the most suitable specialist for you."
            ),
            "sources": [],
            "web_sources": [],
            "chunks_retrieved": 0,
            "detected_practice_areas": [],
            "graph_entities": [],
            "related_documents": [],
        }

    # Generate deterministic bridging response
    answer = _generate_lawyer_bridging_response(detected_areas)

    return {
        "answer": answer,
        "sources": [],
        "web_sources": [],
        "chunks_retrieved": 0,
        "detected_practice_areas": detected_areas,
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


def _extract_practice_areas_llm(conversation_text: str) -> list[str]:
    """
    Use the LLM to extract the most relevant practice areas from the full
    conversation context, instead of naive keyword matching.
    """
    import json as _json

    valid_areas = {
        "Criminal Law", "Civil Litigation", "Corporate Law", "Family Law",
        "Property Law", "Labour Law", "Tax Law", "Constitutional Law",
        "Environmental Law", "Intellectual Property", "Motor Traffic Law",
        "Banking Law", "Immigration Law", "Insurance Law", "Real Estate",
        "Notary Services",
    }

    try:
        llm = get_llm()
        prompt = ChatPromptTemplate.from_messages([
            ("system", LAWYER_AREA_EXTRACTION_PROMPT),
            ("human", "{conversation}"),
        ])

        response = llm.invoke(prompt.invoke({"conversation": conversation_text}))
        raw = response.content.strip()
        logger.info(f"[_extract_practice_areas_llm] Raw: {raw}")

        # Strip <think>...</think> reasoning tags
        cleaned = _strip_think_tags(raw)

        # Strip markdown fences if present
        if cleaned.startswith("```"):
            cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
            cleaned = re.sub(r'\s*```$', '', cleaned)

        # Try to find a JSON array in the output
        json_match = re.search(r'\[.*?\]', cleaned, re.DOTALL)
        if json_match:
            cleaned = json_match.group(0)

        areas = _json.loads(cleaned)
        if isinstance(areas, list):
            return [a for a in areas if a in valid_areas][:3]

    except Exception as e:
        logger.warning(f"[_extract_practice_areas_llm] Failed: {e}")

    return []


def _generate_lawyer_bridging_response(detected_areas: list[str]) -> str:
    """
    Generate a short, deterministic response that bridges to the lawyer
    suggestions the frontend will display.

    Uses a template instead of an LLM call — reasoning models ignore
    brevity instructions and produce lengthy legal essays.
    """
    area_descriptions = {
        "Criminal Law": "a Criminal Defense Lawyer",
        "Civil Litigation": "a Civil Litigation Lawyer",
        "Corporate Law": "a Corporate / Commercial Lawyer",
        "Family Law": "a Family Law Specialist",
        "Property Law": "a Property Lawyer",
        "Labour Law": "an Employment / Labour Lawyer",
        "Tax Law": "a Tax Lawyer",
        "Constitutional Law": "a Constitutional Lawyer",
        "Environmental Law": "an Environmental Lawyer",
        "Intellectual Property": "an IP Lawyer",
        "Motor Traffic Law": "a Motor Traffic / Personal Injury Lawyer",
        "Banking Law": "a Banking & Finance Lawyer",
        "Immigration Law": "an Immigration Lawyer",
        "Insurance Law": "an Insurance Claims Lawyer",
        "Real Estate": "a Real Estate / Conveyancing Lawyer",
        "Notary Services": "a Notary Public",
    }

    specialist_parts = []
    for area in detected_areas:
        desc = area_descriptions.get(area, f"a {area} specialist")
        specialist_parts.append(f"**{desc}**")

    if len(specialist_parts) == 1:
        specialists_text = specialist_parts[0]
    elif len(specialist_parts) == 2:
        specialists_text = f"{specialist_parts[0]} or {specialist_parts[1]}"
    else:
        specialists_text = ", ".join(specialist_parts[:-1]) + f", or {specialist_parts[-1]}"

    return (
        f"Based on our conversation, I'd recommend consulting {specialists_text} "
        f"for your situation. I've found some matching lawyers on our platform below "
        f"who may be able to help you."
    )
