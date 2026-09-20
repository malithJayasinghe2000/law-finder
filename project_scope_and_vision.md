> # ⚠️ SUPERSEDED — DO NOT BUILD FROM THIS DOCUMENT
>
> This describes the **original marketplace product**, written before the legal
> restructure. It is kept as a historical record of where the project started.
>
> **It promises things that are unlawful in Sri Lanka** and that were removed across
> Phases 0–8 — sponsored listings and paid placement, commission on consultation fees,
> star ratings and reviews, "Inquire Now" lead generation, published fee ranges, and an
> AI that recommends particular lawyers. Touting is a **criminal offence** under the
> Intermeddlers with Suitors Ordinance No. 11 of 1894 and it reaches the **platform
> operator**, not only the attorney.
>
> **If you build from this document, you will rebuild the illegal product.**
>
> 👉 Read **[lawyer-finder-web/docs/THE-PROJECT.md](./lawyer-finder-web/docs/THE-PROJECT.md)**
> instead. For what is still accurate here (the tech stack, the folder structure, the
> i18n and validation conventions), cross-check it against
> [lawyer-finder-web/AGENTS.md](./lawyer-finder-web/AGENTS.md).

---

# Project Vision & Scope: "Next-Level" Lawyer Finder Platform (Sri Lanka)

## 1. Executive Summary
A centralized, intelligent digital platform connecting Sri Lankan citizens with verified legal professionals. It combines AI-driven guidance, a community knowledge base, and a seamless booking system to democratize access to legal services while providing lawyers with a powerful tool for client acquisition.

## 2. Platform Value Proposition
- **For Users:** Simplifies the daunting process of finding the right lawyer, provides preliminary AI-assisted legal guidance, and offers educational content to understand legal rights.
- **For Lawyers:** Acts as a digital storefront to build reputation through verified reviews and published articles, streamlining client intake and appointment scheduling.

## 3. Core Features (The "Next Level" Scope)

### A. Intelligent Lawyer Discovery & Verification
- **Smart Search & Filtering:** Filter by specialization (e.g., Land Dispute, Family Law, Corporate, Criminal), location (District/City), language proficiency (Sinhala, Tamil, English), and fee structure.
- **BASL Verification:** Integrate a manual or semi-automated verification process using the Bar Association of Sri Lanka (BASL) registration number to ensure no fake profiles.
- **Verified Review System:** Clients can leave ratings and reviews only after a confirmed consultation, ensuring authenticity.

### B. AI Legal Assistant (Trilingual Chatbot)
- **"Legal Triage" Bot:** An AI trained to understand natural language queries (in Sinhala, Tamil, and English). It doesn't give legally binding advice but identifies the *type* of lawyer needed.
- **Scenario:** *User: "My landlord is trying to evict me without notice."* -> *Bot: "This falls under Tenancy & Property Law. In Sri Lanka, you typically need formal notice. Would you like me to connect you with top property lawyers in Colombo?"*

### C. Community & Knowledge Hub (Blog System)
- **Lawyer Insights:** Lawyers can publish articles on common legal issues. This acts as content marketing, boosting their profile's visibility and SEO.
- **User Experiences:** A moderated forum or blog where users share their experiences with legal procedures (e.g., "How I registered my startup in Sri Lanka"), fostering a helpful community.

### D. Consultation & Practice Management
- **Integrated Scheduling:** Calendar sync for users to book time slots for initial consultations.
- **Virtual Consultations:** Built-in video conferencing for remote consultations.
- **Document Vault:** A secure, encrypted space for users to upload relevant case documents before meeting the lawyer.

## 4. Revenue Model (Phased Approach)

### Phase 1: Growth & Adoption
- **Free Core Access:** Free registration for regular users and a basic free profile for lawyers.
- **Sponsored Listings / Ads:** Lawyers can pay to appear at the top of search results in their specific category or district (e.g., "Sponsored Property Lawyer in Kandy").

### Phase 2: Monetization & Premium Features
- **Premium Subscription for Lawyers:** Monthly/Annual fee for advanced features (e.g., analytics on profile views, unlimited video consultations, priority article publishing).
- **Payment Gateway Integration:** Charge a secure percentage/commission for initial online consultation fees processed through the platform.

## 5. Technology Stack Recommendations
- **Frontend/Mobile:** React Native or Flutter (for cross-platform mobile apps), Next.js / React (for the web platform) to ensure SEO-friendly lawyer profiles.
- **Backend:** Node.js (Express/NestJS) or Python (Django/FastAPI) built on microservices for scalability.
- **AI/Chatbot:** OpenAI API or a fine-tuned open-source LLM, augmented with Retrieval-Augmented Generation (RAG) using Sri Lankan legal FAQs.
- **Database:** PostgreSQL (for relational data like users/appointments) + Redis (for caching).
- **Cloud:** AWS or Google Cloud Platform, ensuring data is hosted securely.
