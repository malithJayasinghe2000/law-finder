# Legal Library: how to add laws, and where things stand

> Written 2026-10-23 for the owner, to pick this work up again after deployment.
> Short version: **official sources only, one law at a time, four steps.**

---

## 1. The idea in one minute

- A **main law** is either an **Ordinance** (made before 1948, e.g. the Penal Code, 1883) or
  an **Act** (made by Parliament after 1948).
- An **amendment** is a later Act that changes a main law. In our system it is an Act with
  "Amends which law?" set, and it is listed on its law's page.
- **Main law + all its amendments = the law today.**
- Everything we upload is shown in the **library** and read by the **AI** (RAG).

## 2. Where to get documents (official only)

| What | Where | Notes |
|---|---|---|
| Old laws as they stood in **1980** (Ordinances and older Acts) | **CommonLII**: http://www.commonlii.org/lk/legis/consol_act/ | Government text (LawNet, Ministry of Justice), "Copyright 2005 Sri Lanka Government". Pick the letter, open the law, click **PDF version**. Some laws are missing (e.g. the main Motor Traffic Act). The site blocks scripts, so download by hand in a browser. |
| Every Act passed by Parliament (1949 to today), including amendments | **Parliament**: https://www.parliament.lk/en/business-of-parliament/acts-listing | Used automatically by **New from Parliament** in the admin. Old ones are scans (OCR handles them). Some old ones have no PDF. |
| Ministry of Justice | https://lawnet.gov.lk | Not checked yet; may have newer official texts. |

**Never use** lankalaw.net, justice.lk or any other private platform. Their PDFs carry their
name and may carry their copyright. (The Companies Act copy we had carried Lanka Law's cover.)

## 3. The 4 steps for each law

### Step 1: Download the main law
CommonLII, then the letter, then the law, then **PDF version**. Check page 1 shows the right
law and copy the page's web address.

If CommonLII does not have it and the law is from after 1948, the main Act is on Parliament's
site: use **Find** in step 3 and add the main Act first with "None - a new law in its own right".

### Step 2: Upload it
**Admin > Legal Documents > Upload Document**:

| Field | What to put |
|---|---|
| Title | `<Name> (1980 Revised Edition)`, e.g. `Penal Code (1980 Revised Edition)` |
| Type | **Ordinances** (before 1948) or **Acts** |
| Subjects | 1 to 4 that fit |
| Number / Year | e.g. `No. 2 of 1883` / `1883` |
| Includes amendments up to | **1980** for a CommonLII text (it already contains changes up to 1980). Empty for a text as passed. |
| Amends which law? | **None** (it is the law itself) |
| Source | **Revised Legislative Enactments 1980** for CommonLII; **Parliament of Sri Lanka** for Parliament |
| Web address | the CommonLII page, e.g. `http://www.commonlii.org/lk/legis/consol_act/pc25130` |

Wait until the status is **Active** (a long law takes 1 to 2 minutes).

### Step 3: Add its amendments
**Admin > Legal Documents > New from Parliament > Find** the law's name (e.g. `Penal Code`).

- **Add to library** every Act **after 1980** (or after the year in "Includes amendments up
  to"). "Amends which law?" is filled in for you; check it, tick the subject.
- **Dismiss** Acts from 1980 or earlier: the page says "already includes amendments up to 1980".
- If the main law came from Parliament (no 1980 text), add **all** amendments, not just after 1980.
- A row saying "(Special Provisions)" is usually a separate law: add it with "None", or dismiss.
- Refresh the page after adding a main law, so its amendments match it.

### Step 4: Remove the old copy from the AI (only for the 8 laws listed in section 5)
**All Documents** > find the old archived copy (no "(1980 Revised Edition)", source "Not
recorded") > **trash icon** "Remove from the AI" > type the title exactly.

Then ask AI Chat one real question about that law. If the answer got worse, the old copy can
go back: set it to retry (ask Claude), and it stays hidden from the library.

## 4. Things that can go wrong, and what the system already does

| Problem | What happens |
|---|---|
| Old Act is a **scan** (picture of pages) | The AI service runs **OCR** automatically (`ocrmypdf`), then shrinks its own copy. The library keeps the original scan. |
| A **failed** document | **All Documents** > the **Retry** button (circle arrow). |
| Parliament links the **wrong PDF** | Approval checks the PDF mentions the Act's number and refuses it if not. Seen: Penal Code (Amendment) No. 32 of 1991 opens the Telecommunications Act. Dismiss it. |
| **Very large** scan (over 140 MB) | Refused. Ask Claude to OCR and shrink it by hand (done for Motor Traffic 1951, 300 MB). |
| Act listed **without a PDF** | Skipped; the Find message counts them. Find the text elsewhere (Government Printer). |
| Amendment says "A law not in the library yet..." | Do not add it blindly: it would create a second copy of the law. Add/check the main law first, refresh. |

## 5. Status on 2026-10-23

**Done (library and AI on official texts):**
- Penal Code: 1980 text + 7 amendments (1995-2021). Missing: No. 32 of 1991 (wrong PDF on Parliament).
- Civil Procedure Code: 1980 text + 19 amendments (1988-2024).
- Prescription Ordinance: 1980 text + No. 26 of 2014; Prescription (Special Provisions) 2016 as its own law.
- Computer Crime Act, No. 24 of 2007 (Government Printer copy).

**Library official, AI still uses the old copy:**
- Motor Traffic Act: 1951 Act + 19 amendments in the library (4 more have no PDF). The AI keeps the
  old merged copy because it could not work out today's fines from 19 separate changes. Needs a
  merged text (OPEN-ITEMS D8).

**To do, old copy still in the AI (8):**

| Law | Main text from | Then Find |
|---|---|---|
| Notaries Ordinance | CommonLII, N | `Notaries` |
| Powers of Attorney Ordinance | CommonLII, P | `Powers of Attorney` |
| Prevention of Frauds Ordinance | CommonLII, P | `Prevention of Frauds` |
| Registration of Documents Ordinance | CommonLII, R | `Registration of Documents` |
| Land Development Ordinance | CommonLII, L | `Land Development` |
| Companies Act, No. 7 of 2007 | Parliament (Find `Companies`, add the 2007 Act first) | same search |
| Partition Law, No. 21 of 1977 | Parliament (Find `Partition`) | same search |
| Land (Restrictions on Alienation) Act, No. 38 of 2014 | Parliament (Find `Land (Restrictions`) | same search |

**Laws listed without their own text yet** (they have an amendment, shown as "Original text:
being added"; **Missing original** tab): Animals Act; Constitution; Convention on the Suppression
of Terrorist Financing Act; Employment of Women, Young Persons and Children Act; Judicature Act;
National Environmental Act; National Water Supply and Drainage Board Act; Prevention of Money
Laundering Act; Promotion of Export Agriculture Act. Use **Upload original** on each.

**Still waiting in New from Parliament (6):** Inland Revenue (Amendment); Mediation (Civil and
Commercial Disputes); Motor Traffic (Special Provisions); Rescue, Rehabilitation and Insolvency;
Social Security Contribution Levy (Amendment); Value Added Tax (Amendment).

**After that:** choose the 30 to 50 most-used laws for launch (family, land, employment,
criminal, consumer) and add them the same way. Don't call the library "every law in Sri Lanka"
until the main ones are in.

## 6. For deployment

| Need | Why | Where |
|---|---|---|
| `apt install ocrmypdf` on the AI server (brings Ghostscript) | OCR of scans, shrinking | lawyer-rag/README.md |
| `MAX_CONTENT_LENGTH_MB=150` in lawyer-rag `.env` | big scans | lawyer-rag/.env.example |
| `npm run db:deploy` | the library tables (types, amendments, Parliament queue) | migration `20261021120000_...` |
| Weekly job: `npm run jobs:weekly` (Mondays 04:00) | checks Parliament for new Acts | docs/scheduled-jobs.md |
| `storage/legal-documents/` on the website server, backed up | the website's copies of every PDF (not in git) | src/lib/legalDocuments.ts |
| `lawyer-rag/data/` | the AI's index and PDFs (in git today; it is the only backup) | OPEN-ITEMS |
| A reverse proxy that allows uploads of ~150 MB to `/api/admin/legal-documents` | admin uploads of scans | src/proxy.ts note |

## 7. Open items linked to the library

In `docs/OPEN-ITEMS.md`: **D7** old Ordinances (source found: CommonLII), **D7b** scans and the
wrong 1991 PDF, **D7c** the AI cannot answer basic Prescription questions (its 0.62 relevance
bar; re-run the test set), **D8** merged "current version" texts, **D9** replacing the old copies.
