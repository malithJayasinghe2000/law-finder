import logging
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from app.core.llm import get_llm

logger = logging.getLogger(__name__)

ROUTER_PROMPT = """You are an intent classification assistant for a legal AI.
Your job is to classify the user's latest message into one of three categories based on its intent.

CATEGORIES:
- "conversational": The user is greeting, saying thanks, acknowledging, saying goodbye, or engaging in small talk (e.g., "hello", "okay thanks", "got it", "good morning").
- "follow_up": The user is asking a legal question that relies on the conversation history to make sense (e.g., "what is the penalty for that?", "does this apply to minors?", "explain the second point").
- "legal_query": The user is asking a clear, standalone legal question that can be understood without any prior context (e.g., "What is the penalty for murder in Sri Lanka?", "How do I register a company?").

Analyze the conversation history and the user's latest message.
Respond with EXACTLY ONE WORD from the list below and nothing else:
conversational
follow_up
legal_query
"""

REWRITE_PROMPT = """You are a helpful assistant for a legal AI. 
Your task is to rewrite a follow-up question into a fully standalone legal question that can be understood without the conversation history.

Use the conversation history provided to figure out what the user is referring to. Replace any pronouns or ambiguous references (like "that", "it", "the first one") with the specific legal topic, law, or subject being discussed.

If the question is already clear, just return it as is.
Only return the rewritten question. Do NOT include any explanations or conversational text.

User's follow-up question: {question}
"""

CONVERSATIONAL_PROMPT = """You are LawyerAI, an expert legal assistant specialized in Sri Lankan law.
The user just sent a conversational message, greeting, or acknowledgement.
Respond politely and concisely as an AI assistant. Do NOT provide legal advice or invent legal context.
If they say thanks, say you're welcome. If they say hello, ask how you can help them with Sri Lankan law today.
"""

import re

def classify_intent(question: str, chat_history: list) -> str:
    """Classifies the user query intent to decide the RAG flow."""
    # Fast heuristic for common conversational phrases to avoid LLM confusion
    clean_text = re.sub(r'[^a-zA-Z\s]', '', question.lower()).strip()
    conversational_phrases = {"hi", "hello", "hey", "thanks", "thank you", "ok", "okay", "okay thanks", "got it", "good morning", "good evening", "bye", "goodbye", "cool", "awesome", "great"}
    if clean_text in conversational_phrases:
        return "conversational"
        
    try:
        llm = get_llm()
        
        # We construct a specific prompt just for routing
        prompt = ChatPromptTemplate.from_messages([
            ("system", ROUTER_PROMPT),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{question}"),
        ])
        
        # We need the convert_chat_history from rag_chain to convert the history
        # Importing here to avoid circular imports
        from app.core.rag_chain import convert_chat_history
        # Only use the last 4 messages for intent classification to improve speed and focus
        recent_history = chat_history[-4:] if chat_history else []
        langchain_history = convert_chat_history(recent_history)
        
        response = llm.invoke(prompt.invoke({
            "chat_history": langchain_history,
            "question": question
        }))
        
        intent = response.content.strip().lower()
        
        # Clean up in case the LLM was chatty
        if "conversational" in intent: return "conversational"
        if "follow_up" in intent: return "follow_up"
        
        # Default to legal_query if unsure
        return "legal_query"
        
    except Exception as e:
        logger.error(f"Error classifying intent: {e}")
        return "legal_query" # Fallback to standard RAG

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
            "question": question
        }))
        
        rewritten = response.content.strip()
        logger.info(f"Query rewritten: '{question}' -> '{rewritten}'")
        return rewritten
        
    except Exception as e:
        logger.error(f"Error rewriting query: {e}")
        return question # Fallback to original

def generate_conversational_response(question: str, chat_history: list) -> str:
    """Generates a simple conversational response without RAG."""
    try:
        llm = get_llm()
        # For purely conversational responses, we drop the chat history entirely.
        # This prevents the LLM from being confused by long legal explanations in previous turns
        # and significantly speeds up the response time.
        prompt = ChatPromptTemplate.from_messages([
            ("system", CONVERSATIONAL_PROMPT),
            ("human", "{question}"),
        ])
        
        response = llm.invoke(prompt.invoke({
            "question": question
        }))
        
        return response.content.strip()
        
    except Exception as e:
        logger.error(f"Error generating conversational response: {e}")
        return "Hello! How can I assist you with Sri Lankan law today?"
