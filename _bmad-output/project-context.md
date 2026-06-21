---
project_name: 'law-finder'
user_name: 'Malithjayasinghe'
date: '2026-06-18'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 27
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Web Frontend & Server (Next.js App)
- **Framework:** Next.js `16.2.1` (App Router)
- **Core Library:** React `19.2.4` (React Compiler enabled)
- **Programming Language:** TypeScript `5.x` (Strict mode enabled)
- **Database ORM:** Prisma `7.5.0` (Connection configured via `prisma.config.ts`, using `@prisma/adapter-pg` driver)
- **Styling:** TailwindCSS `4.x` (Theme overrides defined inline in `globals.css` instead of `tailwind.config.js`)
- **State Management:** Zustand `5.0.12`
- **Internationalization (i18n):** `next-intl` (Localized routes nested in `/src/app/[locale]/`)
- **Component UI:** Shadcn UI `4.1.0` / Base UI `1.3.0`

### Python RAG Service (Flask backend)
- **API Server:** Flask `>=3.0.0` with Flask-CORS
- **Vector Database:** ChromaDB `>=1.0.0`
- **Orchestration:** LangChain `>=0.3.0` (including `langchain-community`, `langchain-chroma`, `langchain-ollama`)
- **PDF Parsing:** PyMuPDF `>=1.25.0`

## Critical Implementation Rules

### Language-Specific Rules

#### TypeScript (Frontend & API)
- **Strict Typing:** Keep strict mode active. Avoid `any` types; define explicit interfaces or types for all payloads, states, and function arguments.
- **Path Aliases:** Use path aliases (`@/components/...`, `@/lib/...`, `@/store/...`) instead of relative paths (e.g. `../../components/...`).
- **Async Operations:** Always handle asynchronous database queries and API calls with `async/await` wrapped in `try/catch` blocks.
- **API Error Responses:** Next.js API routes must return standardized JSON structures with correct HTTP status codes (e.g., `400` Bad Request, `401` Unauthorized, `403` Forbidden, `500` Internal Server Error).

#### Python (RAG Backend)
- **Type Hinting:** Use type hints for all function signatures (e.g., `def query_index(prompt: str) -> dict:`) to preserve readability.
- **Error Boundaries:** Wrap database connections (ChromaDB) and LLM API requests in robust try-except blocks to catch connection timeouts and resource exhaustion early.
- **Imports Grouping:** Group standard library imports, third-party imports (Flask, LangChain), and local imports separately, separated by a blank line.

### Framework-Specific Rules

#### Next.js & React 19
- **Server vs Client Components:** React Server Components (RSC) are the default. Add the `'use client'` directive at the very top of files only if they use browser APIs, hooks (`useState`, `useEffect`), or interactive events (`onClick`).
- **Data Fetching:** Fetch database data directly in Server Components using Prisma (`src/lib/db.ts`). Avoid writing unnecessary `/api/...` wrapper endpoints if the data is only used for server-side rendering (RSC).
- **React Compiler:** Since `reactCompiler: true` is enabled in `next.config.ts`, do not manually write `useMemo` or `useCallback` optimizations unless specifically profiling shows performance issues.
- **Zustand Stores:** Always put stores under `src/store/` (e.g., `useUIStore.ts`). Use selective selector imports (e.g. `const isSidebarOpen = useUIStore((state) => state.isSidebarOpen)`) to prevent unnecessary component re-renders.
- **i18n Integration:** Use `useTranslations` from `next-intl` for localization. All views must reference keys defined in `messages/{en,si,ta}.json`.

#### Flask & LangChain (RAG)
- **Stateful Connections:** Ensure the vector database (ChromaDB client) is instantiated as a singleton or cached globally to avoid exhausting file descriptors or opening duplicate connection pools on every request.
- **Text Splitters:** Use appropriate splitter strategies (e.g., `RecursiveCharacterTextSplitter` with explicit `chunk_size` and `chunk_overlap` constants) and document chunking configurations clearly.

### Testing Rules

- **Manual Verification (Immediate Role-Testing):** Since there is no automated testing suite initialized, agents must manually verify all features by logging in with seed database roles:
  - **Admin:** `admin@lawfinder.lk` / `password123` (Dashboard & verification controls)
  - **Lawyer:** `lawyer@lawfinder.lk` / `password123` (Inbox & article authoring)
  - **Citizen:** `citizen@lawfinder.lk` / `password123` (Search, reviews, and inquiries)
- **Test Organization (Future Automated Tests):**
  - **Unit Tests:** Place next to the source code file under test (e.g., `src/lib/auth.test.ts` next to `src/lib/auth.ts`).
  - **E2E/Integration Tests:** Place inside a `/tests` folder in the respective project root.
- **Mocking External APIs:** Always mock external API calls in tests (Cloudinary, Nodemailer, Google Translate API, and local Python RAG server endpoints) to prevent test timeouts and side effects.

### Code Quality & Style Rules

- **Naming Conventions:**
  - **Component Files:** Reusable UI components must be in `PascalCase` (e.g., `ChatWidget.tsx`, `Header.tsx`).
  - **Hooks & Stores:** Custom hooks and Zustand state stores must be in `camelCase` (e.g., `useSocket.ts`, `useUIStore.ts`).
  - **Routes & Groups:** Route folders must strictly match Next.js standards: route groups in parentheses `(public)`, dynamic segments in brackets `[id]`, and locale routes in `[locale]`.
  - **Helper Scripts:** Helper/utility files must use camelCase (e.g., `db.ts`, `auth.ts`).
- **Imports & Dependencies:**
  - Always import `db` from `@/lib/db.ts` (which implements Prisma Client caching) rather than instantiating `new PrismaClient()` directly in components or endpoints.
  - Place Zod data validation schemas inside `src/schemas/` to keep them shared across frontend inputs and backend API route handlers.
- **Linting:**
  - Follow the TypeScript and Next.js Core Web Vitals guidelines configured in `eslint.config.mjs`. Run `npm run lint` before committing code to check for validation issues.

### Development Workflow Rules

- **Branch Naming:** Keep branch names descriptive and structured, for example:
  - New features: `feature/<story-id>-<short-description>`
  - Bug fixes: `bugfix/<issue-id>-<short-description>`
- **Commit Messages:** Follow standard semantic commit guidelines:
  - Structure: `<type>(<scope>): <short description>` (e.g. `feat(auth): inject HTTP-only JWT cookies`, `fix(ui): adjust dashboard layout responsiveness`).
  - Use lowercase imperative present tense (e.g. "add" instead of "added").
- **Pre-commit Checklist:** Before declaring a story or feature finished, verify:
  1. No compilation errors exist: run TypeScript validation (`npx tsc --noEmit`).
  2. No lint violations exist: run `npm run lint`.
  3. Dev server runs correctly: run `npm run dev` and perform manual verification.

### Critical Don't-Miss Rules

- **Anti-Patterns to Avoid:**
  - **Database Connection Leaks:** Never run `new PrismaClient()` directly in endpoints or services. Always use the shared cache instance: `import { db } from '@/lib/db'`.
  - **Hardcoded Secrets:** Never hardcode database URLs, JSON Web Token keys, Cloudinary upload keys, or RAG server connection endpoints. They must remain in environment variables (`.env`) which must never be committed.
- **Security & Authorization:**
  - **Gatekeeping Endpoint Actions:** Never assume a route or handler is secure just because it sits under `/dashboard`. Always read the role metadata (`ADMIN`, `LAWYER`, `CLIENT`) from the JWT and throw a `403 Forbidden` response for unauthorized attempts.
- **Edge Cases & Gotchas:**
  - **Language Fallback:** When reading route parameters (`[locale]`), verify that it is one of the supported lang codes (`en`, `si`, `ta`). Fallback to `en` if it's undefined or invalid.
  - **Chroma Collection Double-Initialization:** In the Python backend, check if a collection exists in ChromaDB before trying to recreate it, preventing duplicate document insertion or schema collision.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code.
- Follow ALL rules exactly as documented.
- When in doubt, prefer the more restrictive option.
- Update this file if new patterns emerge.

**For Humans:**

- Keep this file lean and focused on agent needs.
- Update when technology stack changes.
- Review quarterly for outdated rules.
- Remove rules that become obvious over time.

Last Updated: 2026-06-18
