"""
LawyerAI RAG System - Knowledge Graph Store

Manages a NetworkX-based knowledge graph for Graph RAG.
Entities are legal concepts: Acts, Sections, Courts, Legal Concepts.
Relationships connect them: AMENDS, REPEALS, REFERENCES, PART_OF, RELATED_TO, etc.

The graph is persisted as JSON and loaded on startup.
"""

import json
import logging
from pathlib import Path
from typing import Optional

import networkx as nx

from app.config import config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Relationship types used in the legal knowledge graph
# ---------------------------------------------------------------------------
RELATIONSHIP_TYPES = [
    "AMENDS",           # Amendment Act → Principal Act
    "REPEALS",          # New provision → Old provision
    "REFERENCES",       # Section → another Section or Act
    "PART_OF",          # Section → Act, Chapter → Act
    "RELATED_TO",       # Semantic legal relationship
    "CITED_IN",         # Act cited in case law
    "SUPERSEDED_BY",    # Old section → newer replacement
    "DEFINED_IN",       # Legal term → Section where defined
]

# Entity types
ENTITY_TYPES = [
    "ACT",              # Full act or ordinance
    "SECTION",          # Specific section of an act
    "CHAPTER",          # Chapter within an act
    "PART",             # Part within an act
    "CASE_LAW",         # Court decision / case report
    "COURT",            # Court name (Supreme Court, Court of Appeal, etc.)
    "LEGAL_CONCEPT",    # Abstract legal concept (e.g., "bail", "habeas corpus")
    "GAZETTE",          # Gazette notification
]

_graph_instance = None


class KnowledgeGraph:
    """
    Manages a persistent knowledge graph of legal entities and relationships.
    Uses NetworkX for in-memory graph operations and JSON for persistence.
    """

    def __init__(self, persist_path: Optional[str] = None):
        self.persist_path = Path(persist_path or config.GRAPH_PERSIST_PATH)
        self.graph = nx.DiGraph()
        self._load()

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _load(self):
        """Load the graph from disk if it exists."""
        if self.persist_path.exists():
            try:
                with open(self.persist_path, "r", encoding="utf-8") as f:
                    data = json.load(f)

                # Rebuild graph from serialized data
                for node in data.get("nodes", []):
                    self.graph.add_node(node["id"], **node.get("attrs", {}))
                for edge in data.get("edges", []):
                    self.graph.add_edge(
                        edge["source"], edge["target"], **edge.get("attrs", {})
                    )

                logger.info(
                    f"Knowledge graph loaded: {self.graph.number_of_nodes()} nodes, "
                    f"{self.graph.number_of_edges()} edges"
                )
            except Exception as e:
                logger.warning(f"Failed to load knowledge graph: {e}. Starting fresh.")
                self.graph = nx.DiGraph()
        else:
            logger.info("No existing knowledge graph found. Starting fresh.")

    def save(self):
        """Persist the graph to disk as JSON."""
        data = {
            "nodes": [
                {"id": n, "attrs": dict(self.graph.nodes[n])}
                for n in self.graph.nodes
            ],
            "edges": [
                {
                    "source": u,
                    "target": v,
                    "attrs": dict(self.graph.edges[u, v]),
                }
                for u, v in self.graph.edges
            ],
        }
        self.persist_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.persist_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        logger.info(
            f"Knowledge graph saved: {self.graph.number_of_nodes()} nodes, "
            f"{self.graph.number_of_edges()} edges"
        )

    # ------------------------------------------------------------------
    # Entity (Node) Operations
    # ------------------------------------------------------------------

    def add_entity(
        self,
        entity_id: str,
        entity_type: str,
        name: str,
        document_name: Optional[str] = None,
        **extra_attrs,
    ) -> str:
        """
        Add or update an entity (node) in the graph.

        Args:
            entity_id: Unique identifier (e.g., "act::civil_procedure_code")
            entity_type: One of ENTITY_TYPES
            name: Human-readable name
            document_name: Source document name (for linking to vector store)
            **extra_attrs: Additional metadata

        Returns:
            The entity_id
        """
        attrs = {
            "type": entity_type,
            "name": name,
            "document_name": document_name or "",
            **extra_attrs,
        }

        if self.graph.has_node(entity_id):
            # Merge attributes without overwriting existing ones unless provided
            existing = dict(self.graph.nodes[entity_id])
            existing.update({k: v for k, v in attrs.items() if v})
            self.graph.nodes[entity_id].update(existing)
        else:
            self.graph.add_node(entity_id, **attrs)

        return entity_id

    def get_entity(self, entity_id: str) -> Optional[dict]:
        """Get entity attributes by ID."""
        if self.graph.has_node(entity_id):
            return {"id": entity_id, **dict(self.graph.nodes[entity_id])}
        return None

    # ------------------------------------------------------------------
    # Relationship (Edge) Operations
    # ------------------------------------------------------------------

    def add_relationship(
        self,
        source_id: str,
        target_id: str,
        relationship_type: str,
        **extra_attrs,
    ):
        """
        Add a directed relationship between two entities.

        Args:
            source_id: Source entity ID
            target_id: Target entity ID
            relationship_type: One of RELATIONSHIP_TYPES
            **extra_attrs: Additional edge metadata
        """
        self.graph.add_edge(
            source_id,
            target_id,
            type=relationship_type,
            **extra_attrs,
        )

    # ------------------------------------------------------------------
    # Query Operations for Graph RAG
    # ------------------------------------------------------------------

    def get_related_entities(
        self,
        entity_id: str,
        max_depth: int = None,
        relationship_types: Optional[list[str]] = None,
    ) -> list[dict]:
        """
        Get entities related to the given entity via graph traversal.

        Args:
            entity_id: Starting entity
            max_depth: Maximum traversal depth (hops)
            relationship_types: Filter to specific relationship types

        Returns:
            List of related entity dicts with path info
        """
        if max_depth is None:
            max_depth = config.GRAPH_TRAVERSAL_DEPTH

        if not self.graph.has_node(entity_id):
            return []

        related = []
        visited = {entity_id}

        # BFS traversal
        queue = [(entity_id, 0)]
        while queue:
            current, depth = queue.pop(0)
            if depth >= max_depth:
                continue

            # Outgoing edges
            for _, neighbor, edge_data in self.graph.out_edges(current, data=True):
                if neighbor in visited:
                    continue
                if relationship_types and edge_data.get("type") not in relationship_types:
                    continue
                visited.add(neighbor)
                node_data = dict(self.graph.nodes[neighbor])
                related.append({
                    "id": neighbor,
                    "depth": depth + 1,
                    "relationship": edge_data.get("type", "RELATED_TO"),
                    "via": current,
                    **node_data,
                })
                queue.append((neighbor, depth + 1))

            # Incoming edges (bidirectional traversal)
            for neighbor, _, edge_data in self.graph.in_edges(current, data=True):
                if neighbor in visited:
                    continue
                if relationship_types and edge_data.get("type") not in relationship_types:
                    continue
                visited.add(neighbor)
                node_data = dict(self.graph.nodes[neighbor])
                related.append({
                    "id": neighbor,
                    "depth": depth + 1,
                    "relationship": edge_data.get("type", "RELATED_TO"),
                    "via": current,
                    **node_data,
                })
                queue.append((neighbor, depth + 1))

        return related

    def find_entities_by_name(self, name_query: str, entity_type: Optional[str] = None) -> list[dict]:
        """
        Find entities whose name contains the query string.

        Args:
            name_query: Partial name to search for
            entity_type: Filter to specific entity type

        Returns:
            List of matching entity dicts
        """
        query_lower = name_query.lower()
        results = []

        for node_id, data in self.graph.nodes(data=True):
            node_name = data.get("name", "").lower()
            if query_lower in node_name:
                if entity_type and data.get("type") != entity_type:
                    continue
                results.append({"id": node_id, **data})

        return results

    def get_document_entities(self, document_name: str) -> list[dict]:
        """Get all entities associated with a specific document."""
        results = []
        for node_id, data in self.graph.nodes(data=True):
            if data.get("document_name", "").lower() == document_name.lower():
                results.append({"id": node_id, **data})
        return results

    def get_related_documents(self, document_name: str) -> list[str]:
        """
        Find documents related to the given document via the knowledge graph.
        Follows entity relationships to discover connected documents.
        """
        # First, find all entities from this document
        doc_entities = self.get_document_entities(document_name)
        if not doc_entities:
            return []

        related_docs = set()
        for entity in doc_entities:
            # Get related entities up to configured depth
            related = self.get_related_entities(entity["id"])
            for rel in related:
                rel_doc = rel.get("document_name", "")
                if rel_doc and rel_doc.lower() != document_name.lower():
                    related_docs.add(rel_doc)

        return sorted(related_docs)

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------

    def get_stats(self) -> dict:
        """Get graph statistics."""
        type_counts = {}
        for _, data in self.graph.nodes(data=True):
            t = data.get("type", "UNKNOWN")
            type_counts[t] = type_counts.get(t, 0) + 1

        rel_counts = {}
        for _, _, data in self.graph.edges(data=True):
            t = data.get("type", "UNKNOWN")
            rel_counts[t] = rel_counts.get(t, 0) + 1

        return {
            "total_nodes": self.graph.number_of_nodes(),
            "total_edges": self.graph.number_of_edges(),
            "entity_types": type_counts,
            "relationship_types": rel_counts,
        }

    def get_graph_data_for_document(self, document_name: str) -> dict:
        """
        Get graph visualization data for a specific document.
        Returns nodes and edges in a format suitable for frontend rendering.
        """
        doc_entities = self.get_document_entities(document_name)
        if not doc_entities:
            return {"nodes": [], "edges": []}

        # Collect all relevant nodes and edges
        node_ids = set()
        nodes = []
        edges = []

        for entity in doc_entities:
            node_ids.add(entity["id"])

        # Add related nodes (1 hop)
        for entity in doc_entities:
            related = self.get_related_entities(entity["id"], max_depth=1)
            for rel in related:
                node_ids.add(rel["id"])

        # Build node list
        for nid in node_ids:
            if self.graph.has_node(nid):
                data = dict(self.graph.nodes[nid])
                nodes.append({"id": nid, **data})

        # Build edge list (only edges between our nodes)
        for u, v, data in self.graph.edges(data=True):
            if u in node_ids and v in node_ids:
                edges.append({
                    "source": u,
                    "target": v,
                    "type": data.get("type", "RELATED_TO"),
                })

        return {"nodes": nodes, "edges": edges}

    def remove_document_entities(self, document_name: str) -> int:
        """Remove all entities associated with a document."""
        to_remove = []
        for node_id, data in self.graph.nodes(data=True):
            if data.get("document_name", "").lower() == document_name.lower():
                to_remove.append(node_id)

        for nid in to_remove:
            self.graph.remove_node(nid)

        if to_remove:
            self.save()
            logger.info(f"Removed {len(to_remove)} entities for document: {document_name}")

        return len(to_remove)


def get_knowledge_graph() -> KnowledgeGraph:
    """Get or create a singleton KnowledgeGraph instance."""
    global _graph_instance
    if _graph_instance is None:
        _graph_instance = KnowledgeGraph()
    return _graph_instance
