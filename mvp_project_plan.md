# Minimum Viable Product (MVP) Plan: Sri Lankan Lawyer Finder

The MVP focuses on proving the core concept: **Will real lawyers sign up, and will real citizens use the platform to find them?** We will intentionally strip out complex features (like calendar syncing, built-in video calls, and complex payment gateways) to launch within 1-2 months.

## 1. Core MVP Features

### A. User Management & Authentication
*   **Three User Roles:** Admin (You), Lawyer, and Client/Citizen.
*   **Simple Onboarding:** Social login (Google/Facebook) for clients. Standard Email/Password + BASL ID verification for lawyers.

### B. The Lawyer Directory & Profiles (The Core)
*   **Detailed Profiles:** Lawyers can upload a professional photo, bio, education, practice areas, languages spoken, and their general consultation fee range.
*   **Intelligent Search System:** Users can search and filter the directory based strictly on:
    *   Practice Area (e.g., Labor Law, Family Law, Property/Land)
    *   District / Location
    *   Language (Sinhala, Tamil, English)
*   **Lead Generation (Instead of direct booking):** An "Inquire Now" button on the lawyer's profile that sends an email or SMS notification directly to the lawyer with the client's contact info and a brief description of the issue.

### C. The Knowledge Hub (Blog)
*   **Article Publishing:** A simple CMS where Lawyers can publish legal articles (e.g., "What to do in a hit-and-run"). 
*   This is critical for the MVP because it gives users a reason to visit the site even if they don't immediately need a lawyer, and it builds the platform's SEO presence on Google.

### D. Basic AI "Legal Assistant"
*   **Triage Chatbot:** A simple chat interface powered by an LLM (like OpenAI's API) provided with a custom prompt instructing it to act as a Sri Lankan legal guide. 
*   **MVP Scope:** It will answer FAQs based on a static database of Sri Lankan law and at the end of every interaction, provide a link: *"Find verified lawyers for this issue here."*

### E. Trust System
*   **Review Submission:** After an interaction, users can leave a simple 1-5 star text review. (For the MVP, an admin can manually approve reviews to prevent spam/abuse).

## 2. What is EXCLUDED from the MVP?
*   *Built-in Video Calls* (Lawyers can just use Zoom/WhatsApp).
*   *In-App Calendar Syncing* (Too complex for V1; lawyers manage their own schedules).
*   *Payment Processing* (Monetization begins in Phase 2; the platform is free initially to acquire users rapidly).
*   *Secure Document Vault* (Lawyers can request documents directly via email for now).

## 3. Recommended Tech Stack for the MVP
To build this fast, securely, and cheaply:

*   **Frontend (User Interface):** **Next.js** + **TailwindCSS**. Next.js is crucial because it ensures that every lawyer's profile and blog post is indexed perfectly by Google, which is how you will get organic traffic.
*   **Backend & Database:** **Supabase**. This provides authentication, a scalable PostgreSQL database, and file storage (for profile pictures) out of the box. It heavily reduces backend development time.
*   **AI Integration:** **OpenAI API** (`gpt-4o-mini` for cost-effectiveness), accessed via simple API routes in Next.js.
*   **Deployment & Hosting:** **Vercel** (Seamless integration with Next.js and very generous free tiers).
