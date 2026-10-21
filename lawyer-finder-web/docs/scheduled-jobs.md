# Scheduled Jobs

What has to run on a timer, how often, and why each one matters.

> Written 2026-09-06, Phase 8. Until now **nothing in this project ran on a
> schedule at all** — `privacy:purge`, `ai:purge` and `/api/ads/expire` were all
> manual, and had to be remembered by a person.
>
> That is worth naming precisely: a retention schedule nobody runs is a
> retention **document**, not a retention **policy**. The PDPA asks about the
> second. `RETENTION_SCHEDULE` in `src/lib/privacy/policy.ts` describes periods
> that were not, in fact, being applied to anything.

---

## The jobs

| Job | Command | How often | What happens if it does not run |
| --- | --- | --- | --- |
| **Retention purge** | `npm run privacy:purge` | Daily | Personal data is kept past the period we publish in the privacy notice. That makes the notice inaccurate, which is its own breach |
| **Advert expiry** | `npm run ads:expire` | Daily | Campaigns keep serving past their end date — we would be showing adverts nobody is entitled to run |

Both together:

```bash
npm run jobs:daily
```

`privacy:purge` **supersedes** `ai:purge` — it is driven by the whole retention
schedule rather than one model, and AI conversations are one entry in it. Do not
schedule both; `ai:purge` is kept only because it is referenced in older notes.

### Dry run first

```bash
npm run privacy:purge -- --dry
```

Prints what it *would* delete and touches nothing. Run this before scheduling
the job for the first time in any new environment.

---

## What the purge will never do, and how you can tell

It cannot delete matter data — `Booking`, `ConflictCheck`, `Quote`,
`EngagementLetter`, `FeeNote`, `BookingPayment`, or attorney↔client `Message`.
That is not a setting; `assertPurgeable()` refuses every firm-controlled model
and the job calls it for each one.

The reason is the controller/processor split: those records belong to the **law
firm**, and a retention job deleting a firm's conflict-check records on our own
authority would destroy evidence the firm may be professionally required to
keep. That is the single thing a processor may not do.

**The job prints what it did not touch on every run.** Do not "clean up" that
output. It exists so the gap cannot go quiet once the job is running unattended
— an operator reading the log should be able to see the refusal, not infer it.

> Matter and conflict-check retention periods are **counsel question 7(c)** and
> are still unanswered. Until they are, nothing firm-controlled expires
> automatically. The job refuses rather than guessing.

---

## Wiring it up

Both forms need the same environment as the app: `DATABASE_URL`, and for the
matter data to be readable at all, `MATTER_ENCRYPTION_KEYS` (see
[encryption-key-custody.md](./encryption-key-custody.md)).

### System cron

```cron
# 03:15 daily — quiet hours, and after any nightly backup
15 3 * * * cd /srv/lawyer-finder-web && /usr/bin/npm run jobs:daily >> /var/log/lawfinder-jobs.log 2>&1
# 04:00 Mondays — Parliament's Acts listing, for the Legal Library review queue
0 4 * * 1 cd /srv/lawyer-finder-web && /usr/bin/npm run jobs:weekly >> /var/log/lawfinder-jobs.log 2>&1
```

`jobs:weekly` reads Parliament's Acts listing and queues new Acts under Admin > Legal
Documents > New from Parliament. It only queues: nothing reaches the library or the AI
until an admin approves it. A run that catches up marks every law with no pending
amendment as "checked" today; that date is shown on each law's page.

### A platform scheduler (Vercel Cron, GitHub Actions, Cloud Scheduler)

`/api/ads/expire` is already an HTTP endpoint guarded by a shared secret, so a
scheduler can call it directly:

```
POST https://<host>/api/ads/expire?token=$CRON_SECRET
```

Set `CRON_SECRET` in the environment. If it is unset the route does **not**
check the token — acceptable in local development, not in production. Set it.

The retention purge deliberately has **no HTTP endpoint**. It deletes personal
data across many models, and an endpoint is a thing that can be called by
someone who should not be able to call it. It runs from a shell with database
credentials, where the audience is already whoever holds those credentials.

---

## Monitoring

A scheduled job that silently stops is worse than one that was never scheduled,
because everybody now believes the data is being purged.

- Send the output somewhere a person sees — a log the team reads, or an alert.
- Alert on **absence**: if no successful purge has been recorded for 48 hours,
  somebody should be told. Failure is usually silent; absence is the symptom.
- The purge prints per-model counts. A count that jumps by an order of magnitude
  is worth understanding before the next run.

---

## Related

- `src/lib/privacy/policy.ts` — `RETENTION_SCHEDULE`, the only place periods live
- `npm run check:pdpa` — asserts the purge cannot reach matter data
- [DATA-INVENTORY.md](./restructure/DATA-INVENTORY.md) — what is held and for how long
- [encryption-key-custody.md](./encryption-key-custody.md) — the key these jobs need
