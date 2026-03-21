# Technical Project Plan: Sri Lankan Lawyer Finder MVP

This document serves as the technical blueprint for the MVP. It outlines the architecture, database schema, required APIs, and a phased roadmap. Crucially, it defines the strict **Foundation Level Best Practices** necessary before feature development begins.

## 1. Tech Stack Overview
*   **Frontend Framework:** Next.js 14+ (App Router) with React 18+
*   **Styling & UI:** Tailwind CSS + Shadcn UI (Radix Primitives)
*   **Internationalization (i18n):** `next-intl` (Mandatory for Sinhala, Tamil, English dynamic routing)
*   **Data Validation:** Zod + React Hook Form (Strict full-stack validation)
*   **Global State:** Zustand (For lightweight global UI state)
*   **Database:** PostgreSQL (DigitalOcean Managed DB)
*   **ORM:** Prisma ORM (Type-safe database interaction)
*   **Authentication:** Custom JWT-based authentication
*   **File Storage:** Cloudinary
*   **AI Integration:** OpenAI API (`gpt-4o-mini`)
*   **Deployment:** DigitalOcean App Platform / Droplet

## 2. System Architecture & Foundation Best Practices

To ensure a robust, scalable, and professional platform, the following "Next Level" foundation practices must be implemented from **Day 1**:

*   **Trilingual Routing (i18n):** The app natively supports English (`en`), Sinhala (`si`), and Tamil (`ta`). Using `next-intl`, the URL structure dictates the language (e.g., `/si/lawyers`). This is **mandatory** for Google SEO so trailing index bots accurately map Sinhala and Tamil legal search queries to the correct page version.
*   **Strict End-to-End Validation:** Every single form uses `react-hook-form` coupled with a strongly typed `Zod` schema. **Critically**, the exact same Zod schema is imported into the backend API routes (`app/api/...`) to prevent bad or malicious data from ever reaching PostgreSQL.
*   **Global Error & Loading States:** Every major route segment in Next.js relies heavily on `loading.tsx` (for elegant skeleton loaders while Prisma DB fetches data) and `error.tsx` (to gracefully catch crashes with fallback UI). 
*   **Global Layouts & Themes:** Tailwind CSS variable-based theming (Dark/Light mode) must be configured from the start to prevent inline hard-coded colors. Global toast notifications (e.g., `sonner`) will provide feedback for every user/API action.
*   **The Backend (API Layer):** Next.js Route Handlers (`app/api/.../route.ts`) act as the backend REST API server. These securely process requests, validate JWT `HttpOnly` cookies, and parse Prisma schemas.

## 3. Database Schema (PostgreSQL via Prisma ORM)

**Model: `User`**
*   `id` (UUID, Primary Key)
*   `email` (String, Unique)
*   `passwordHash` (String)
*   `role` (Enum: `ADMIN`, `LAWYER`, `CLIENT`)
*   `createdAt` (DateTime)

**Model: `LawyerProfile`**
*   `id` (UUID, Primary Key, Foreign Key to `User.id`)
*   `fullName` (String)
*   `baslNumber` (String, Unique)
*   `profileImageUrl` (String - Cloudinary URL)
*   `bio` (Text)
*   `practiceAreas` (String Array)
*   `languages` (String Array)
*   `district` (String)
*   `baseFeeRange` (String)
*   `isVerified` (Boolean, Default: false - Admin approval)

**Model: `Inquiry` (Leads/Contact Requests)**
*   `id` (UUID, Primary Key, Foreign Key to `LawyerProfile.id`)
*   `clientName` (String)
*   `clientPhone` (String)
*   `clientEmail` (String)
*   `message` (Text)
*   `status` (Enum: `PENDING`, `CONTACTED`)
*   `createdAt` (DateTime)

**Model: `Article` (Blog)**
*   `id` (UUID, Primary Key, Foreign Key to `LawyerProfile.id`)
*   `title` (String)
*   `slug` (String, Unique)
*   `content` (Text)
*   `status` (Enum: `DRAFT`, `PUBLISHED`)
*   `createdAt` (DateTime)

**Model: `Review`**
*   `id` (UUID, Primary Key, Foreign Key to `LawyerProfile.id`)
*   `reviewerName` (String)
*   `rating` (Integer: 1-5)
*   `comment` (Text)
*   `isApproved` (Boolean, Default: false)

## 4. Next.js Routing Structure (App Router + i18n)
*   `app/[locale]/page.tsx` -> Landing Page (locale = en, si, or ta)
*   `app/[locale]/lawyers/page.tsx` -> Law Directory
*   `app/[locale]/lawyers/[id]/page.tsx` -> Lawyer Public Profile
*   `app/[locale]/blog/page.tsx` -> Blog Index
*   `app/[locale]/dashboard/...` -> Protected Dashboards
*   **API Routes (Custom Backend):**
    *   `app/api/auth/register/route.ts` 
    *   `app/api/auth/login/route.ts` 
    *   `app/api/lawyers/route.ts` 
    *   `app/api/upload/route.ts` 
    *   `app/api/chat/route.ts` 

## 5. Development Roadmap (Phased approach)

### Phase 1: The "Next-Level" Foundation (Week 1)
*   **Task 1.1:** Initialize Next.js 14. Establish the **Internationalization (i18n)** layer natively into the App Router (`[locale]`) using `next-intl`. Configure translation dictionaries (`en.json`, `si.json`, `ta.json`).
*   **Task 1.2:** Configure Tailwind CSS variables (Dark/Light mode) and install Shadcn UI. Establish the global notification (`sonner`) and `Zustand` global state foundation.
*   **Task 1.3:** Configure DigitalOcean PostgreSQL database and initialize Prisma ORM (write `schema.prisma` and run migrations).
*   **Task 1.4:** Build Custom JWT Authentication. Generate `HttpOnly` cookies, secure the API routes, and build Next.js `middleware.ts` to block unauthorized dashboard access and handle default locale redirection.

### Phase 2: Core Directory & Storage (Week 2)
*   **Task 2.1:** Set up Cloudinary account and build secure API route for file uploads.
*   **Task 2.2:** Build the Lawyer Dashboard. **(Rule: Every form must use Zod Validation + React Hook form sharing schemas with the API layer)**.
*   **Task 2.3:** Build the public Lawyer Directory. Query Prisma efficiently based on District/Language. Implement `loading.tsx` skeletons for seamless UX.
*   **Task 2.4:** Build "Inquire Now" modal. Insert record via Prisma and trigger an external email notification.

### Phase 3: The Knowledge Hub (Week 3)
*   **Task 3.1:** Add a rich text editor to Lawyer Dashboard for articles.
*   **Task 3.2:** Build the public Blog UI. Configure Next.js to fetch published articles using Prisma SSR queries ensuring language locale correctness.
*   **Task 3.3:** Build the Admin Dashboard (a secure view ensuring the requester's JWT contains `role: ADMIN` to verify lawyers and reviews).

### Phase 4: Trilingual AI & Deployment Integration (Week 4)
*   **Task 4.1:** Create the internal Next.js API Route for the OpenAI Chatbot. Configure the AI Prompt dynamically based on the current active UI `locale`.
*   **Task 4.2:** Build the frontend widget allowing users to ask legal triage questions.
*   **Task 4.3:** Production deployment. Configure DigitalOcean App Platform, provision SSL, and launch.
