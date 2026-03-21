# Architecture & Developer Manual: Sri Lankan Lawyer Finder MVP

This document serves as the "Developer Guide" for navigating the custom Next.js App Router workspace, understanding the authentication architecture, and establishing the foundational `src/` directory folder structure. 

## 1. Authentication Roles & Permissions (RBAC)

The custom JWT implementation relies strictly on Role-Based Access Control. A user's `role` (stored in the Postgres `User` table) dictates exactly what they can access in the `/dashboard` and which `/api/...` endpoints they can trigger.

*   `CLIENT`: The default role for general citizens.
    *   **Can:** Search lawyers, view articles, "Inquire Now", update their own basic account.
    *   **Cannot:** Access lawyer/admin dashboards or publish blog posts.
*   `LAWYER`: The professional role.
    *   **Can:** Everything `CLIENT` can do, **PLUS** access `/dashboard/lawyer` to modify their public `LawyerProfile`, view their private `Inquiries` inbox, and author new `Articles`.
    *   **Cannot:** Moderate other lawyers or verify their own BASL status.
*   `ADMIN`: The moderation override role.
    *   **Can:** Access `/dashboard/admin`, verify `LawyerProfile.isVerified = true` (after checking BASL manually), approve `Review.isApproved = true`, and manage all system data.

*Note: The Next.js `src/middleware.ts` functions as the gatekeeper. It intercepts all incoming requests, checks for a valid `HttpOnly` JWT cookie, decodes the role, and immediately redirects unauthorized attempts to the `/login` page.*

## 2. The `src/` Folder Structure (Next.js App Router)

The project strictly enforces a modular structure separating UI routes, the custom API backend, global components, and utility libraries.

```text
workspace/
├── src/
│   ├── app/                        # Next.js App Router (All Pages & APIs)
│   │   ├── [locale]/               # i18n Root (Languages: en, si, ta)
│   │   │   ├── (auth)/             # Route Group: Unstyled layout for auth
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   ├── (public)/           # Route Group: Standard Header/Footer wrapper
│   │   │   │   ├── lawyers/
│   │   │   │   │   ├── page.tsx    # Public Law Directory & Filters
│   │   │   │   │   └── [id]/       # Dynamic Lawyer Profile view
│   │   │   │   ├── blog/
│   │   │   │   └── page.tsx        # Homepage Landing
│   │   │   ├── dashboard/          # Protected Routes (JWT Required)
│   │   │   │   ├── layout.tsx      # Dashboard sidebar shell
│   │   │   │   ├── lawyer/page.tsx # Lawyer controls
│   │   │   │   └── admin/page.tsx  # Admin controls
│   │   │   ├── layout.tsx          # Global HTML/Body Root layout
│   │   │   └── error.tsx           # Global Error Catch Boundary
│   │   └── api/                    # Custom Backend (REST Endpoints)
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   ├── register/route.ts
│   │       │   └── logout/route.ts
│   │       ├── lawyers/route.ts    # Fetch/Filter lawyer logic
│   │       ├── inquiries/route.ts
│   │       └── webhooks/route.ts
│   ├── components/                 # Reusable UI React Components
│   │   ├── ui/                     # Shadcn base components (Buttons, Cards)
│   │   ├── layout/                 # Site Header, Footer, Dashboard Sidebar
│   │   ├── forms/                  # React-Hook-Forms UI templates
│   │   └── shared/                 # Loading Skeletons, ChatWidget
│   ├── lib/                        # Utility Functions
│   │   ├── db.ts                   # Prisma Client Instantiation Cache
│   │   ├── auth.ts                 # JWT signing/verifying utilities
│   │   └── utils.ts                # Tailwind merge (cn) helpers
│   ├── store/                      # Global UI State Management
│   │   └── useUIStore.ts           # Zustand store (Dark mode, Modals)
│   ├── schemas/                    # Zod Data Validation (End-to-End)
│   │   ├── auth.schema.ts          # Shared across Frontend & Backend API
│   │   └── profile.schema.ts
│   └── middleware.ts               # Core Auth & i18n Guard
├── prisma/                         # Database ORM
│   └── schema.prisma               # Postgres Schema definitions
├── messages/                       # next-intl translations
│   ├── en.json
│   ├── si.json
│   └── ta.json
├── package.json
└── tailwind.config.ts
```

## 3. The Execution Sequence

**Step 1: Next.js Foundation Scaffold**
Execute `npx create-next-app` to generate the core files. Ensure TypeScript, Tailwind CSS, and the App Router are selected.

**Step 2: i18n & Middleware Architecture**
Immediately configure `next-intl` and establish `middleware.ts`. This acts as the routing spine of the app. English (`en`) will act as the default fallback.

**Step 3: Zod & Components (`shadcn-ui`)**
Initialize the Shadcn CLI to inject `radix-ui` unstyled accessible components directly into `src/components/ui`. Establish the Zod schema directory so frontend forms have secure validation to depend on.

**Step 4: Prisma Database Connectivity**
Execute `npx prisma init` to generate the schema file. Developers must connect a `.env` database string to their local or DigitalOcean Postgres database and push the structural migrations using `npx prisma db push`.
