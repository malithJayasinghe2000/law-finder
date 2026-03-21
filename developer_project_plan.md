# Technical Project Plan: Sri Lankan Lawyer Finder MVP

This document serves as the technical blueprint for the development team building the MVP. It outlines the architecture, database schema, required APIs, and a phased roadmap.

## 1. Tech Stack Overview
*   **Frontend Framework:** Next.js 14+ (App Router) with React 18+
*   **Styling:** Tailwind CSS + Shadcn UI (For rapid, clean, and accessible UI components)
*   **Backend & Database:** Supabase (PostgreSQL, Authentication, File Storage)
*   **AI Integration:** OpenAI API (`gpt-4o-mini`) via Next.js Serverless API Routes
*   **Emails:** Resend (for simple API-based transactional emails)
*   **Deployment:** Vercel

## 2. System Architecture

The MVP will utilize a serverless architecture to ensure high performance, excellent SEO, and low initial hosting costs.
*   **Next.js** handles the frontend UI and backend API routes seamlessly.
*   **Supabase** acts as the definitive backend. It handles Row-Level Security (RLS) to ensure users can only edit their own data, manages authentication, and processes direct SQL queries via the Supabase JS Client.
*   **Rendering Strategy:** Client-Side Rendering (CSR) is used for dashboards. Server-Side Rendering (SSR) and Incremental Static Regeneration (ISR) must be used for the Lawyer Directory and Blog to ensure Google perfectly indexes the profiles and articles.

## 3. Database Schema (Supabase / PostgreSQL)

**Table: `users` (Managed by Supabase Auth)**
*   `id` (UUID, Primary Key)
*   `email` (String)
*   `role` (Enum: `ADMIN`, `LAWYER`, `CLIENT`)
*   `created_at` (Timestamp)

**Table: `lawyer_profiles`**
*   `id` (UUID, Primary Key, Foreign Key to `users.id`)
*   `full_name` (String)
*   `basl_number` (String, Unique)
*   `profile_image_url` (String - linked to Supabase Storage bucket)
*   `bio` (Text)
*   `practice_areas` (Array of Strings: e.g., `['Family', 'Property']`)
*   `languages` (Array of Strings: e.g., `['Sinhala', 'English']`)
*   `district` (String)
*   `base_fee_range` (String)
*   `is_verified` (Boolean, Default: false - Admin must manually verify BASL)

**Table: `inquiries` (Leads/Contact Requests)**
*   `id` (UUID, Primary Key)
*   `lawyer_id` (UUID, Foreign Key to `lawyer_profiles.id`)
*   `client_name` (String)
*   `client_phone` (String)
*   `client_email` (String)
*   `message` (Text)
*   `status` (Enum: `PENDING`, `CONTACTED`)
*   `created_at` (Timestamp)

**Table: `articles` (Blog)**
*   `id` (UUID, Primary Key)
*   `author_id` (UUID, Foreign Key to `lawyer_profiles.id`)
*   `title` (String)
*   `slug` (String, Unique)
*   `content` (Text - Markdown or HTML)
*   `status` (Enum: `DRAFT`, `PUBLISHED`)
*   `created_at` (Timestamp)

**Table: `reviews`**
*   `id` (UUID, Primary Key)
*   `lawyer_id` (UUID, Foreign Key to `lawyer_profiles.id`)
*   `reviewer_name` (String)
*   `rating` (Integer: 1-5)
*   `comment` (Text)
*   `is_approved` (Boolean, Default: false - Admin moderation)

## 4. Next.js Routing Structure (App Router)
*   `app/page.tsx` -> Landing Page (Hero, Search Bar, Featured Lawyers)
*   `app/lawyers/page.tsx` -> Law Directory (Search & Filter UI)
*   `app/lawyers/[id]/page.tsx` -> Lawyer Public Profile
*   `app/blog/page.tsx` -> Blog Index
*   `app/blog/[slug]/page.tsx` -> Single Article Page
*   `app/dashboard/lawyer/page.tsx` -> Lawyer Private Dashboard (Edit Profile, View Inquiries)
*   `app/dashboard/admin/page.tsx` -> Admin Dashboard (Verify Lawyers, Approve Reviews)
*   `app/api/chat/route.ts` -> OpenAI Chatbot Backend Endpoint

## 5. Development Roadmap (Phased approach)

### Phase 1: Foundation & Auth (Week 1)
*   **Task 1.1:** Initialize Next.js with TailwindCSS and Shadcn UI.
*   **Task 1.2:** Set up Supabase project, execute SQL schema, and configure strict Row Level Security (RLS) policies.
*   **Task 1.3:** Implement Supabase Auth (Email/Password for Lawyers).
*   **Task 1.4:** Build user role middleware to protect Admin and Lawyer specific routes using Next.js `middleware.ts`.

### Phase 2: Core Directory & Profiles (Week 2)
*   **Task 2.1:** Build the Lawyer Dashboard (Profile creation form, image upload to Supabase Storage).
*   **Task 2.2:** Build the public Lawyer Directory (`/lawyers`). Implement complex search/filtering logic against Supabase.
*   **Task 2.3:** Build individual public lawyer profile pages.
*   **Task 2.4:** Build the "Inquire Now" modal. When submitted, insert into `inquiries` table and trigger an email notification (via Resend) to the Lawyer.

### Phase 3: The Knowledge Hub (Week 3)
*   **Task 3.1:** Add a text editor (e.g., TipTap or React Quill) to the Lawyer Dashboard for writing articles.
*   **Task 3.2:** Build the public Blog UI and fetch articles from Supabase.
*   **Task 3.3:** Build the Admin Dashboard (a secure view to approve `is_verified` for lawyers and `is_approved` for reviews).

### Phase 4: AI Chatbot & Deployment (Week 4)
*   **Task 4.1:** Create the Next.js API Route integrating the OpenAI SDK using `gpt-4o-mini`.
*   **Task 4.2:** Design a strict system prompt (e.g., "You are a legal assistant for Sri Lanka. Do not give binding advice. Summarize the user's issue and recommend a practice area category...").
*   **Task 4.3:** Build the floating chat widget UI using Vercel AI SDK for streaming responses.
*   **Task 4.4:** Final QA, performance optimization (Lighthouse score > 90), and one-click deployment to Vercel.
