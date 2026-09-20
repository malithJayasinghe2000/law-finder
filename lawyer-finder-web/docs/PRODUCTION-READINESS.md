# Production Readiness — the gap between `localhost` and a real law firm

> Written 2026-09-12. A checklist with reasoning, not a wish list.
>
> **This system has never been deployed.** It runs on one laptop against a local Postgres.
> Everything below is the work between that and a Sri Lankan practice trusting it with
> privileged client files.

---

## Why the bar is higher here than for ordinary software

Three things make this different from a normal SaaS launch, and each raises the bar:

1. **The data is privileged.** A leak is not only a breach — privilege can be *lost* if a
   third party is in the conversation, which means our incident can damage a client's
   position **in their own case**. We are not the only ones who pay for our mistakes.
2. **We are a processor, not a controller, for the most sensitive data we hold.** Our
   duties run to the **firm**: act only on instruction, secure the data, notify *them* of a
   breach, and return or delete on termination. A firm's own regulator may ask them about
   us.
3. **Losing the encryption key destroys the data.** That risk was accepted deliberately in
   Phase 7 in exchange for a database dump being worthless. It is only an acceptable trade
   if the key is genuinely looked after.

---

## 1. 🔴 Deployment — nothing exists

| Item | State | Notes |
| --- | --- | --- |
| Hosting | ❌ None | Next.js 16 + a Python RAG service + Postgres |
| Containerisation | ❌ No Dockerfile | Two runtimes to orchestrate |
| CI | ❌ None | No automated build, typecheck or checks on push |
| TLS / domain | ❌ None | |
| Managed Postgres | ❌ Local only | Jurisdiction matters — see §6 |
| Environment secrets | ⚠️ `.env` | 21 variables, including the encryption key |

**Minimum viable deployment**

- Build and typecheck on every push, and **run all five `check:*` scripts in CI**. They
  need a database, so CI needs a throwaway Postgres — worth the setup, because these
  checks are the only thing standing between a refactor and a privilege breach.
- One environment to start. A staging environment is a luxury until there are customers;
  **tested backups are not.**
- The RAG service is a second deployable. See §7 — hosted inference removes it as an
  operational burden.

> **CI must run the checks, not just the build.** A green build has never once proved any
> of the seven rules hold, and that sentence is written in four separate documents in this
> repository because it keeps being true.

## 2. 🔴 Backups, and the restore nobody has tested

An untested backup is a belief, not a backup.

- [ ] Automated daily Postgres backups, retained ≥30 days
- [ ] **A restore actually performed into a scratch environment**, with a matter opened
      afterwards to confirm the ciphertext still decrypts
- [ ] Backups stored somewhere **other than the database host**
- [ ] The restore drill repeated whenever the arrangement changes, and at least annually
- [ ] The date of the last successful restore written down somewhere durable

> **Backup and key custody are one procedure, not two.** A database backup without the
> encryption key restores rows of `enc.v1.k1.…` and nothing else. A key without a backup
> protects nothing. Test them together or you have tested neither.

## 3. 🔴 Encryption key custody

Fully specified in [encryption-key-custody.md](./encryption-key-custody.md). **None of it
is provisioned.**

- [ ] Key in a secrets manager, not a `.env` file
- [ ] A second copy in **different custody** from the first
- [ ] **At least two named people** who can produce it
- [ ] A tested restore (see §2)
- [ ] The rotation order understood: retire from the *active* slot first, remove from the
      *ring* last — removing a retired key before `npm run privacy:encrypt` has
      re-encrypted every row destroys those rows exactly as surely as losing it

## 4. 🟠 Monitoring and incident response

| Item | State |
| --- | --- |
| Error tracking | ❌ None — no Sentry, no equivalent |
| Structured logging | ❌ `console.error` |
| Uptime monitoring | ❌ None |
| Alert on the purge **not** running | ❌ None |

**A scheduled job that silently stops is worse than one never scheduled, because everybody
now believes the data is being purged.** Alert on *absence*: no successful purge in 48
hours should tell someone. Failure is usually silent; absence is the symptom.

**Incident response is a PDPA duty, not a nice-to-have.** Write down, before you need it:
who is called, how a firm is notified (our breach duty runs to *them*), and what "loss of
availability" means — because losing the key is a notifiable breach even though nothing
leaked.

## 5. 🟠 Application security

| Item | State | Action |
| --- | --- | --- |
| `JWT_SECRET` | ✅ Fails loudly if unset — no insecure default | — |
| Passwords | ✅ bcrypt | — |
| Matter data at rest | ✅ AES-256-GCM, AEAD-bound to row and column | — |
| Privilege enforcement | ✅ One file, 41 assertions | — |
| Rate limiting | ⚠️ In-memory, 4 routes | Redis; extend to every write route |
| Identity documents | 🔴 No authenticated serving route | Build it — [OPEN-ITEMS C1](./OPEN-ITEMS.md) |
| Security headers / CSP | ❌ Unverified | Add headers; verify |
| Dependency scanning | ❌ None | `npm audit` in CI |
| Session invalidation on role change | ⚠️ Live role is re-read in layouts | Verify it holds everywhere |

> The **legal** access controls are the strongest part of this codebase. The **ordinary**
> web-application controls are the weakest. That asymmetry is unusual, and it is worth
> naming: an attacker does not care that your privilege table is asserted by 41 cases if
> they can read a practising certificate off a guessable URL.

## 6. 🟠 Data residency

The PDPA restricts sending personal data outside Sri Lanka. Two flows could cross a border:

- **Database hosting.** `.env` carries a commented-out Neon `us-east-1` URL. If production
  uses it, **every tier of data leaves the country.**
- **The AI model.** Question text reaches whatever backs the RAG service. Matter data does
  **not** travel this path — `buildModelContext()` takes a question and the chat's own
  history, and has no parameter through which matter data could reach it.

> **Decide the jurisdiction before there is real client data.** Migrating a database
> across borders after a firm's privileged files are in it is a conversation with that
> firm's regulator, not a migration.

This is counsel question 19, and the published privacy notice §8 currently admits it is
unresolved — which was the honest thing to do and is not a permanent position.

## 7. 🟠 The RAG service

Runs **Ollama locally** with a **3-billion-parameter model**, and three different model
names are configured across three files (`qwen3.5:9b`, `gemma4:e2b`, `llama3.2:3b`).
Nobody can currently say which model answers a legal question.

- Local inference needs a GPU-bearing host and is a second service to operate.
- A 3B model is precisely the class that produced the invented *"Employment (Amendment)
  Ordinance No. 14 of 2017"* caught in Phase 5.
- The policy layer catches that — but a weak model means most answers are **withheld**, and
  the feature becomes useless rather than unsafe.

> **Use a hosted inference API in production, settle on one model in one config file, and
> measure the withholding rate** against the 49 `check:ai` cases plus real Sri Lankan legal
> questions. Keep local Ollama for development.

## 8. 🟠 Testing

| Layer | State |
| --- | --- |
| Policy (privilege, AI, billing, PDPA, firm) | ✅ **193 assertions** — genuinely good |
| Unit | ❌ None |
| Integration / API | ❌ None |
| End-to-end | ❌ None |

**Every phase of this project has found a real break by driving the flow by hand.** That is
a test waiting to be written.

> **Start with exactly one Playwright test: the full firm-first engagement** — client
> engages a firm, firm assigns, conflict check, quote, accept, pay, confirm, complete. That
> single path would have caught defects in at least four phases. Add the erasure flow
> second, because it is destructive and irreversible.

## 9. 🔴 Legal and contractual readiness

Not code, and each one blocks the first real customer:

- [ ] **Data-processor agreement** to offer firms (counsel Q4(b)) — no firm should sign up
      without one, and none can be produced today
- [ ] **DPO designated** — the privacy notice currently says we have not
- [ ] **Terms of service** for the firm licence
- [ ] **Counsel sign-off on the engagement letter wording** (Q3) — still an unreviewed
      good-faith draft that real clients would be bound by
- [ ] **Counsel Q16–18** answered before scaling anything consumer-facing

## 10. Ordered checklist

**Before the first real firm:**

1. Deploy with TLS, managed Postgres and CI running the five checks
2. Backups **with a tested restore**
3. Key custody provisioned, restore tested with the backup
4. Authenticated file serving for identity documents
5. Error tracking and uptime monitoring
6. `jobs:daily` on a timer, alerting on absence
7. Processor agreement, DPO, terms of service
8. Database jurisdiction decided

**Before scaling past a handful:**

9. Payment gateway for subscriptions
10. Redis rate limiting on every write route
11. One end-to-end test, running in CI
12. Hosted inference, one model, measured
13. Security headers, CSP, dependency scanning
14. Counsel Q16–18 answered

---

## The honest summary

**The compliance engineering is genuinely strong — stronger than most products of this
size.** Privilege is enforced in one file and asserted 41 ways. Matter data is encrypted
and bound to its row. The AI refuses to advise. The PDPA rights work and are reachable.

**The operational engineering is at zero.** No deployment, no backups, no monitoring, no
tests of any user flow, and the key protecting every matter in the database sits in a
`.env` file on a laptop.

> A platform that has thought harder than anyone about who may *read* a matter description,
> and has no tested backup of the key that makes it readable at all, has not finished
> thinking about confidentiality — it has just finished the interesting half.
