import json
import re
import logging
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from app.core.llm import get_llm

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Smart Router Prompt — classifies intent AND determines document filter
# ---------------------------------------------------------------------------
ROUTER_PROMPT = """You are an intent classification and routing assistant for a legal AI that specializes in Sri Lankan law.

Your job is to analyze the user's latest message and produce a JSON object with two fields.

FIELD 1 — "intent" (required):
- "conversational": The user is greeting, saying thanks, acknowledging, saying goodbye, or engaging in small talk.
- "follow_up": The user is asking a question that relies on the previous conversation to make sense (e.g., "what about that?", "explain the second point", "does this apply to minors?").
- "lawyer_request": The user is asking for a lawyer, requesting a recommendation, wanting legal consultation, or asking to be connected to a lawyer.
- "legal_query": The user is asking a clear, standalone legal question.

FIELD 2 — "document_filter" (required):
Based on the topic of the question, pick the SINGLE most relevant document, or "All" if it spans multiple areas or you are unsure.
Choose from:
- "Motor Traffic Act" — questions about driving, vehicles, road accidents, traffic offences, licences, speed limits
- "Companies Act" — questions about companies, directors, shareholders, incorporation, dividends, corporate governance
- "Civil Procedure Code" — questions about court procedures, filing cases, appeals, injunctions, decrees, evidence
- "Act No. 24 of 2007" — questions about computer crimes, cyber offences, hacking, digital evidence
- "All" — the question is general, spans multiple areas, or you cannot determine the specific act

RULES:
- Return ONLY a valid JSON object, nothing else. No markdown, no explanation.
- If intent is "conversational" or "lawyer_request", always set document_filter to "All".
- Example output: {{"intent": "legal_query", "document_filter": "Motor Traffic Act"}}
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
- For example, if the discussion involves trespass and property damage, "Property Law" and "Civil Litigation" are more relevant than "Real Estate".
- "Real Estate" is for property transactions (buying, selling, conveyancing), NOT for property damage or trespass disputes.
- Return ONLY a valid JSON array of strings. No markdown, no explanation.
- Example: ["Property Law", "Civil Litigation"]
"""

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
}

# Regex to catch various ways users ask for a lawyer (e.g. "need a lawyer", "want consulting from a lawyer")
LAWYER_REQUEST_REGEX = re.compile(
    r'\b(need|want|find|recommend|suggest|get|looking for|require)\b.*\b(lawyer|attorney|counsel|counsil|consultation|consulting|legal advice)\b',
    re.IGNORECASE
)


def classify_intent(question: str, chat_history: list) -> dict:
    """
    Classifies the user query intent AND determines which legal document to search.
    
    Returns:
        dict with keys:
            - "intent": "conversational" | "follow_up" | "legal_query" | "lawyer_request"
            - "document_filter": A specific act name or "All"
    """
    # Fast heuristic for common conversational phrases — zero latency
    clean_text = re.sub(r'[^a-zA-Z\s]', '', question.lower()).strip()
    if clean_text in CONVERSATIONAL_PHRASES:
        logger.info(f"Fast heuristic: '{clean_text}' -> conversational")
        return {"intent": "conversational", "document_filter": "All"}

    # Fast heuristic for lawyer requests — regex match
    if LAWYER_REQUEST_REGEX.search(question):
        logger.info(f"Fast heuristic: matched lawyer regex -> lawyer_request")
        return {"intent": "lawyer_request", "document_filter": "All"}

    try:
        llm = get_llm()

        prompt = ChatPromptTemplate.from_messages([
            ("system", ROUTER_PROMPT),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{question}"),
        ])

        from app.core.rag_chain import convert_chat_history
        # Only use the last 4 messages for speed
        recent_history = chat_history[-4:] if chat_history else []
        langchain_history = convert_chat_history(recent_history)

        response = llm.invoke(prompt.invoke({
            "chat_history": langchain_history,
            "question": question,
        }))

        raw = response.content.strip()
        logger.info(f"Router raw output: {raw}")

        # Parse the JSON response
        result = _parse_router_response(raw)
        logger.info(f"Router parsed: intent={result['intent']}, filter={result['document_filter']}")
        return result

    except Exception as e:
        logger.error(f"Error classifying intent: {e}")
        return {"intent": "legal_query", "document_filter": "All"}


def _parse_router_response(raw: str) -> dict:
    """
    Robustly parse the LLM's JSON response, handling common LLM quirks
    like wrapping JSON in markdown code blocks or adding extra text.
    """
    # Strip markdown code fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        # Remove opening fence (```json or ```)
        cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
        # Remove closing fence
        cleaned = re.sub(r'\s*```$', '', cleaned)

    # Try direct JSON parse
    try:
        parsed = json.loads(cleaned)
        intent = parsed.get("intent", "legal_query").lower().strip()
        doc_filter = parsed.get("document_filter", "All").strip()

        # Validate intent
        if intent not in ("conversational", "follow_up", "legal_query", "lawyer_request"):
            if "conversational" in intent:
                intent = "conversational"
            elif "follow_up" in intent:
                intent = "follow_up"
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
        logger.warning(f"Failed to parse router JSON, falling back to text parsing: {cleaned}")
        # Fallback: try to extract intent from raw text
        lower = cleaned.lower()
        intent = "legal_query"
        if "conversational" in lower:
            intent = "conversational"
        elif "follow_up" in lower:
            intent = "follow_up"
        elif "lawyer" in lower:
            intent = "lawyer_request"

        return {"intent": intent, "document_filter": "All"}


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

        rewritten = response.content.strip()
        logger.info(f"Query rewritten: '{question}' -> '{rewritten}'")
        return rewritten

    except Exception as e:
        logger.error(f"Error rewriting query: {e}")
        return question


def generate_conversational_response(question: str, chat_history: list) -> str:
    """Generates a simple conversational response without RAG."""
    try:
        llm = get_llm()
        # Drop chat history entirely for conversational responses
        prompt = ChatPromptTemplate.from_messages([
            ("system", CONVERSATIONAL_PROMPT),
            ("human", "{question}"),
        ])

        response = llm.invoke(prompt.invoke({
            "question": question,
        }))

        return response.content.strip()

    except Exception as e:
        logger.error(f"Error generating conversational response: {e}")
        return "Hello! How can I assist you with Sri Lankan law today?"


def generate_lawyer_response(question: str, chat_history: list) -> dict:
    """
    Handle lawyer recommendation requests by using an LLM to extract
    practice areas from the full conversation context and generating a
    natural, context-aware bridging response.

    Returns:
        Dict matching the standard query_rag return format.
    """
    from app.core.rag_chain import detect_practice_areas

    # ── Step 1: Build full conversation context (both user AND bot) ────────
    # Include bot responses so the LLM can see what legal areas were discussed
    conversation_text_parts = []
    for msg in (chat_history or [])[-8:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        conversation_text_parts.append(f"{role.upper()}: {content}")
    conversation_text_parts.append(f"USER: {question}")
    conversation_text = "\n\n".join(conversation_text_parts)

    # ── Step 2: LLM-based practice area extraction ─────────────────────────
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
        # No practice areas detected at all — ask the user
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

    # ── Step 3: Generate a natural, context-aware response ─────────────────
    answer = _generate_lawyer_bridging_response(
        conversation_text, detected_areas, chat_history
    )

    return {
        "answer": answer,
        "sources": [],
        "web_sources": [],
        "chunks_retrieved": 0,
        "detected_practice_areas": detected_areas,
        "graph_entities": [],
        "related_documents": [],
    }


def _strip_think_tags(text: str) -> str:
    """Strip DeepSeek-R1's <think>...</think> reasoning tags from output."""
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

        # Strip DeepSeek-R1 <think>...</think> reasoning tags
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
            # Validate each area against the allowed set
            return [a for a in areas if a in valid_areas][:3]

    except Exception as e:
        logger.warning(f"[_extract_practice_areas_llm] Failed: {e}")

    return []


def _generate_lawyer_bridging_response(
    conversation_text: str,
    detected_areas: list[str],
    chat_history: list,
) -> str:
    """
    Generate a short, deterministic response that bridges to the lawyer
    suggestions the frontend will display.

    We deliberately avoid an LLM call here because reasoning models like
    DeepSeek-R1 ignore brevity instructions and produce long legal answers
    instead of the required 2-3 sentence bridging text.
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

    # Build a natural specialist description
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
