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
- If intent is "conversational", always set document_filter to "All".
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


def classify_intent(question: str, chat_history: list) -> dict:
    """
    Classifies the user query intent AND determines which legal document to search.
    
    Returns:
        dict with keys:
            - "intent": "conversational" | "follow_up" | "legal_query"
            - "document_filter": A specific act name or "All"
    """
    # Fast heuristic for common conversational phrases — zero latency
    clean_text = re.sub(r'[^a-zA-Z\s]', '', question.lower()).strip()
    if clean_text in CONVERSATIONAL_PHRASES:
        logger.info(f"Fast heuristic: '{clean_text}' -> conversational")
        return {"intent": "conversational", "document_filter": "All"}

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
        if intent not in ("conversational", "follow_up", "legal_query"):
            if "conversational" in intent:
                intent = "conversational"
            elif "follow_up" in intent:
                intent = "follow_up"
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
