"""
LawyerAI RAG System - Entity & Relationship Extractor

Extracts legal entities (Acts, Sections, Courts, Concepts) and their relationships
from document text chunks. Uses a combination of:
1. Regex patterns for reliable structured extraction (Section X of Act Y)
2. LLM for semantic entity extraction (legal concepts, relationships)

The extracted entities feed into the knowledge graph for Graph RAG.
"""

import re
import logging
from typing import Optional
from dataclasses import dataclass, field

from app.core.llm import get_llm, message_text
from app.config import config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data classes for extracted entities
# ---------------------------------------------------------------------------

@dataclass
class Entity:
    """A legal entity extracted from text."""
    entity_id: str          # Unique ID (e.g., "act::civil_procedure_code")
    entity_type: str        # ACT, SECTION, COURT, LEGAL_CONCEPT, etc.
    name: str               # Human-readable name
    document_name: str = "" # Source document
    extra: dict = field(default_factory=dict)


@dataclass
class Relationship:
    """A relationship between two legal entities."""
    source_id: str
    target_id: str
    relationship_type: str  # AMENDS, REFERENCES, PART_OF, etc.
    extra: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Regex Patterns for Legal Entity Extraction
# ---------------------------------------------------------------------------

# References to other acts: "the Civil Procedure Code", "the Penal Code",
# "Companies Act", "Motor Traffic Act", "Evidence Ordinance"
ACT_REFERENCE_PATTERN = re.compile(
    r"(?:the\s+)?((?:[A-Z][a-z]+\s+)*(?:Act|Code|Ordinance|Law|Statute|Regulation)(?:\s+No\.?\s*\d+)?(?:\s+of\s+\d{4})?)",
    re.MULTILINE,
)

# Cross-references to sections: "Section 14", "section 25A", "Sections 10, 11 and 12"
SECTION_REF_PATTERN = re.compile(
    r"[Ss]ection\s+(\d+[A-Z]?)",
    re.MULTILINE,
)

# "Section X of the Y Act" — specific cross-references
SECTION_OF_ACT_PATTERN = re.compile(
    r"[Ss]ection\s+(\d+[A-Z]?)\s+of\s+(?:the\s+)?((?:[A-Z][a-z]+\s+)*(?:Act|Code|Ordinance))",
    re.MULTILINE,
)

# Court names in Sri Lankan legal context
COURT_PATTERN = re.compile(
    r"(Supreme\s+Court|Court\s+of\s+Appeal|High\s+Court|District\s+Court|Magistrate(?:'?s)?\s+Court|"
    r"Labour\s+Tribunal|Commercial\s+High\s+Court|Provincial\s+High\s+Court)",
    re.IGNORECASE,
)

# Case citation pattern: "SC Appeal 123/2020", "[2024] SLLR 45"
CASE_CITATION_PATTERN = re.compile(
    r"(?:SC|CA|HC)\s*(?:Appeal|Application|Case)?\s*(?:No\.?)?\s*(\d+/\d{4})|"
    r"\[\d{4}\]\s*(?:SLLR|SLR|NLR)\s+\d+",
    re.IGNORECASE,
)

# Amendment references: "as amended by Act No. 24 of 2025"
AMENDMENT_REF_PATTERN = re.compile(
    r"(?:amended|modified|substituted|inserted)\s+by\s+(?:Act\s+No\.?\s*)?(\d+)\s+of\s+(\d{4})",
    re.IGNORECASE,
)


def _normalize_entity_id(entity_type: str, name: str) -> str:
    """Create a normalized entity ID from type and name."""
    clean = re.sub(r"[^a-z0-9\s]", "", name.lower())
    clean = re.sub(r"\s+", "_", clean.strip())
    return f"{entity_type.lower()}::{clean}"


def extract_entities_regex(
    text: str,
    document_name: str = "",
    document_metadata: Optional[dict] = None,
) -> tuple[list[Entity], list[Relationship]]:
    """
    Extract entities and relationships from text using regex patterns.
    Fast and reliable for structured legal references.

    Args:
        text: The text chunk to analyze
        document_name: Name of the source document
        document_metadata: Additional metadata about the document

    Returns:
        Tuple of (entities, relationships)
    """
    entities: list[Entity] = []
    relationships: list[Relationship] = []
    seen_entity_ids = set()

    metadata = document_metadata or {}
    source_doc_type = metadata.get("document_type", "Act")

    # Create entity for the source document itself
    if document_name:
        doc_id = _normalize_entity_id("ACT", document_name)
        if doc_id not in seen_entity_ids:
            entities.append(Entity(
                entity_id=doc_id,
                entity_type="ACT",
                name=document_name,
                document_name=document_name,
                extra={"document_type": source_doc_type},
            ))
            seen_entity_ids.add(doc_id)

    # Extract section number for this chunk
    section_number = metadata.get("section_number", "")
    if section_number and section_number.startswith("Section"):
        sec_id = _normalize_entity_id("SECTION", f"{document_name} {section_number}")
        if sec_id not in seen_entity_ids:
            entities.append(Entity(
                entity_id=sec_id,
                entity_type="SECTION",
                name=f"{section_number} of {document_name}",
                document_name=document_name,
            ))
            seen_entity_ids.add(sec_id)

            # Section is PART_OF the act
            if document_name:
                doc_id = _normalize_entity_id("ACT", document_name)
                relationships.append(Relationship(
                    source_id=sec_id,
                    target_id=doc_id,
                    relationship_type="PART_OF",
                ))

    # Extract cross-references: "Section X of the Y Act"
    for match in SECTION_OF_ACT_PATTERN.finditer(text):
        ref_section = match.group(1)
        ref_act = match.group(2).strip()

        ref_act_id = _normalize_entity_id("ACT", ref_act)
        ref_sec_id = _normalize_entity_id("SECTION", f"{ref_act} Section {ref_section}")

        if ref_act_id not in seen_entity_ids:
            entities.append(Entity(
                entity_id=ref_act_id,
                entity_type="ACT",
                name=ref_act,
            ))
            seen_entity_ids.add(ref_act_id)

        if ref_sec_id not in seen_entity_ids:
            entities.append(Entity(
                entity_id=ref_sec_id,
                entity_type="SECTION",
                name=f"Section {ref_section} of {ref_act}",
            ))
            seen_entity_ids.add(ref_sec_id)

            # Reference relationship
            if document_name:
                doc_id = _normalize_entity_id("ACT", document_name)
                relationships.append(Relationship(
                    source_id=doc_id,
                    target_id=ref_sec_id,
                    relationship_type="REFERENCES",
                ))

    # Extract standalone Act references
    for match in ACT_REFERENCE_PATTERN.finditer(text):
        act_name = match.group(1).strip()
        # Skip if it's the same as the source document
        if act_name.lower() == document_name.lower():
            continue
        # Skip very short/generic matches
        if len(act_name) < 8:
            continue

        act_id = _normalize_entity_id("ACT", act_name)
        if act_id not in seen_entity_ids:
            entities.append(Entity(
                entity_id=act_id,
                entity_type="ACT",
                name=act_name,
            ))
            seen_entity_ids.add(act_id)

            if document_name:
                doc_id = _normalize_entity_id("ACT", document_name)
                relationships.append(Relationship(
                    source_id=doc_id,
                    target_id=act_id,
                    relationship_type="REFERENCES",
                ))

    # Extract court names
    for match in COURT_PATTERN.finditer(text):
        court_name = match.group(1).strip()
        court_id = _normalize_entity_id("COURT", court_name)

        if court_id not in seen_entity_ids:
            entities.append(Entity(
                entity_id=court_id,
                entity_type="COURT",
                name=court_name,
            ))
            seen_entity_ids.add(court_id)

    # Extract amendment references
    for match in AMENDMENT_REF_PATTERN.finditer(text):
        act_num = match.group(1)
        year = match.group(2)
        amend_name = f"Act No. {act_num} of {year}"
        amend_id = _normalize_entity_id("ACT", amend_name)

        if amend_id not in seen_entity_ids:
            entities.append(Entity(
                entity_id=amend_id,
                entity_type="ACT",
                name=amend_name,
                extra={"document_type": "Amendment Act"},
            ))
            seen_entity_ids.add(amend_id)

            if document_name:
                doc_id = _normalize_entity_id("ACT", document_name)
                relationships.append(Relationship(
                    source_id=amend_id,
                    target_id=doc_id,
                    relationship_type="AMENDS",
                ))

    return entities, relationships


def extract_entities_llm(
    text: str,
    document_name: str = "",
) -> tuple[list[Entity], list[Relationship]]:
    """
    Use the LLM to extract semantic legal entities and relationships.
    Slower but catches nuanced legal concepts that regex misses.

    Args:
        text: The text chunk to analyze
        document_name: Name of the source document

    Returns:
        Tuple of (entities, relationships)
    """
    entities: list[Entity] = []
    relationships: list[Relationship] = []

    prompt = f"""Analyze this Sri Lankan legal text and extract key legal concepts.

TEXT:
{text[:2000]}

Return a JSON object with:
- "concepts": list of important legal concepts mentioned (e.g., "bail", "habeas corpus", "fundamental rights", "tort liability")
- "related_acts": list of any Acts, Codes, or Ordinances referenced

Return ONLY valid JSON, no explanation.
Example: {{"concepts": ["bail", "personal liberty"], "related_acts": ["Penal Code", "Criminal Procedure Code"]}}
"""

    try:
        llm = get_llm()
        response = llm.invoke(prompt)
        response_text = message_text(response).strip()

        # Try to parse JSON from response
        json_match = re.search(r"\{[^}]+\}", response_text, re.DOTALL)
        if json_match:
            import json
            data = json.loads(json_match.group())

            # Extract legal concepts
            for concept in data.get("concepts", []):
                if len(concept) < 3 or len(concept) > 100:
                    continue
                concept_id = _normalize_entity_id("LEGAL_CONCEPT", concept)
                entities.append(Entity(
                    entity_id=concept_id,
                    entity_type="LEGAL_CONCEPT",
                    name=concept,
                    document_name=document_name,
                ))

                # Link concept to source document
                if document_name:
                    doc_id = _normalize_entity_id("ACT", document_name)
                    relationships.append(Relationship(
                        source_id=concept_id,
                        target_id=doc_id,
                        relationship_type="DEFINED_IN",
                    ))

            # Extract related acts
            for act in data.get("related_acts", []):
                if len(act) < 5:
                    continue
                act_id = _normalize_entity_id("ACT", act)
                entities.append(Entity(
                    entity_id=act_id,
                    entity_type="ACT",
                    name=act,
                ))
                if document_name:
                    doc_id = _normalize_entity_id("ACT", document_name)
                    relationships.append(Relationship(
                        source_id=doc_id,
                        target_id=act_id,
                        relationship_type="RELATED_TO",
                    ))

    except Exception as e:
        logger.warning(f"LLM entity extraction failed: {e}")

    return entities, relationships


def extract_all_entities(
    text: str,
    document_name: str = "",
    document_metadata: Optional[dict] = None,
    use_llm: bool = False,
) -> tuple[list[Entity], list[Relationship]]:
    """
    Extract all entities and relationships from a text chunk.
    Combines regex and optionally LLM-based extraction.

    Args:
        text: Text chunk to analyze
        document_name: Source document name
        document_metadata: Document metadata dict
        use_llm: Whether to also use LLM extraction (slower, richer)

    Returns:
        Combined tuple of (entities, relationships)
    """
    # Always run regex extraction (fast, reliable)
    entities, relationships = extract_entities_regex(
        text, document_name, document_metadata
    )

    # Optionally run LLM extraction (slower, richer)
    if use_llm:
        llm_entities, llm_rels = extract_entities_llm(text, document_name)
        entities.extend(llm_entities)
        relationships.extend(llm_rels)

    return entities, relationships
