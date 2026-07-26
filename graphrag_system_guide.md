# LawyerAI GraphRAG System Architecture & Verification Guide

This guide details the architecture, design, and internal mechanics of the LawyerAI hybrid **GraphRAG** (Graph Retrieval-Augmented Generation) system.

---

## 1. GraphRAG Overview

Conventional RAG pipelines rely solely on **Vector Databases** (like ChromaDB) to retrieve document chunks using semantic similarity search. While highly effective for fetching direct passages, vector search is blind to the broader relational context of laws (e.g., *which Act amends another Act?*, *which Supreme Court case cited this section?*, *is this provision repealed or active?*).

LawyerAI solves this by combining **Vector Search** with a **Knowledge Graph** (stored using NetworkX and JSON) to form a **Hybrid GraphRAG** pipeline.

```mermaid
graph TD
    UserQuery[User Query] --> IntentRouter{Intent Router}
    IntentRouter -->|Legal Query| VectorSearch[ChromaDB Vector Search]
    VectorSearch -->|Retrieved Chunks| InitialDocs[Initial Documents]
    InitialDocs --> EntityExtractor[Query Entity Extractor]
    EntityExtractor -->|Identified Entities| GraphTraversal[Knowledge Graph Traversal]
    GraphTraversal -->|Traverse Edges| RelatedDocs[Related Documents / Amendments]
    RelatedDocs --> VectorSearch2[ChromaDB Expansion Search]
    VectorSearch2 --> CombinedContext[Merged Context: Vector Chunks + Graph Paths]
    CombinedContext --> LLM[Ollama Local LLM]
    LLM --> FinalResponse[Structured Citations & Answers]
```

---

## 2. Ingestion & Graph Building Pipeline

When a legal document (PDF) is uploaded:
1. **Text Extraction**: PyMuPDF extracts text page by page and injects page boundary markers (`--- PAGE X ---`).
2. **Chunking**: The text is split into semantically coherent legal chunks (bounded by Section/Chapter boundaries) to prevent breaking legal context mid-clause.
3. **Vector Ingestion**: Chunks are embedded using `nomic-embed-text` and written to ChromaDB.
4. **Graph Extraction**: A regex and LLM-based entity parser scans each chunk to extract **Entities** (nodes) and **Relationships** (edges).
5. **Graph Persistence**: The extracted entities are inserted into the global Knowledge Graph and saved as JSON at `data/graph/knowledge_graph.json`.

---

## 3. Knowledge Graph Schema

### Entity (Node) Types
- `ACT`: Represents a full legislation (e.g., *Civil Procedure Code*, *Penal Code*).
- `SECTION`: A specific section/clause of an Act (e.g., *Section 14 of Civil Procedure Code*).
- `CHAPTER`: A structural chapter division.
- `PART`: A major structural part of an Act.
- `COURT`: Sri Lankan judicial courts (e.g., *Supreme Court*, *Court of Appeal*).
- `CASE_LAW`: Specific court rulings and decisions.
- `LEGAL_CONCEPT`: Abstract legal terms (e.g., *bail*, *habeas corpus*).
- `GAZETTE`: Official Gazette notifications.

### Relationship (Edge) Types
- `PART_OF`: Defines structural hierarchy (e.g., `SECTION --[PART_OF]--> CHAPTER --[PART_OF]--> ACT`).
- `REFERENCES`: Section cross-references (e.g., `Section 14 --[REFERENCES]--> Evidence Ordinance`).
- `AMENDS`: Shows legislation updates (e.g., `Amendment Act No. 24 --[AMENDS]--> Civil Procedure Code`).
- `REPEALS`: Shows overrides (e.g., `New Section --[REPEALS]--> Old Section`).
- `CITED_IN`: Connects Acts or Sections to Case Law.
- `DEFINED_IN`: Connects legal concepts to where they are defined.

---

## 4. Verification of the Current System

The active Knowledge Graph has been analyzed and verified successfully.

### Graph Statistics
*   **Total Nodes**: 487
*   **Total Edges**: 479
*   **Node Breakdown**:
    *   `SECTION`: 454 nodes
    *   `ACT`: 28 nodes
    *   `COURT`: 5 nodes
*   **Edge Breakdown**:
    *   `PART_OF`: 426 edges (structural organization)
    *   `REFERENCES`: 53 edges (secondary cross-references)

### Sample Connected Nodes
Below are verified edges extracted from the active `knowledge_graph.json`:
- `act::codeofcriminalproceduerconsolidated2024 --[REFERENCES]--> act::penal_code`
- `act::codeofcriminalproceduerconsolidated2024 --[REFERENCES]--> act::evidence_ordinance`
- `section::codeofcriminalproceduerconsolidated2024_section_15 --[PART_OF]--> act::codeofcriminalproceduerconsolidated2024`
- `section::codeofcriminalproceduerconsolidated2024_section_24 --[PART_OF]--> act::codeofcriminalproceduerconsolidated2024`

This confirms that the GraphRAG system correctly maps the hierarchy of documents and accurately identifies cross-references between different pieces of legislation (e.g., Criminal Procedure Code referencing the Penal Code).

---

## 5. Query-Time Graph Traversal (How GraphRAG Enhances Retrieval)

When a user asks: *"What are the bail provisions under the Criminal Procedure Code?"*
1. **Vector Search** retrieves chunks containing keywords related to "bail" and "Criminal Procedure Code".
2. **Graph Expansion** begins: The query is parsed, identifying the entity `act::codeofcriminalproceduerconsolidated2024` and the concept `legal_concept::bail`.
3. The traversal algorithm queries the graph with a traversal depth of `2` (hops):
   * Hop 1: Finds all sections of the Criminal Procedure Code related to bail.
   * Hop 2: Traverses `REFERENCES` or `AMENDS` edges, discovering connected documents like `Act No. 24 of 2007` (Bail Act) or amendments.
4. The system triggers secondary Vector Searches on these graph-discovered documents.
5. The combined, rich context is formatted for the LLM:
   ```
   ━━━ RELATED LEGAL CONTEXT (Knowledge Graph) ━━━
   📊 Related Legal Entities:
     • [ACT] Bail Act No. 30 of 1997 — (REFERENCES)
     • [SECTION] Section 14 of Criminal Procedure Code — (PART_OF)
   ```
6. The LLM receives this structured context, allowing it to cite the exact connections and deliver highly comprehensive and accurate answers.
