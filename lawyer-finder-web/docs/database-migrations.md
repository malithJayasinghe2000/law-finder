# Database & Migrations Guide

How schema changes work in this project. Read this before you touch
`prisma/schema.prisma`.

## TL;DR

```bash
# 1. Edit prisma/schema.prisma
# 2. Create a migration + apply it locally + regenerate the client
npm run db:migrate -- --name add_engagement_letter

# 3. Commit BOTH the schema change and the generated migration folder
git add prisma/schema.prisma prisma/migrations/
```

**Never use `prisma db push` on a shared or deployed database.** It applies
changes without recording them, which is how this project ended up with a
migration history that did not match reality (see [History](#history) below).

## The rules

1. **Every schema change ships as a migration.** No exceptions once a database is
   shared with anyone else.
2. **Migrations are immutable once pushed.** If a migration is wrong, write a new
   one that fixes it. Editing an applied migration breaks its checksum and every
   other developer's database.
3. **Commit the migration folder with the schema change**, in the same commit. A
   schema change without its migration is a broken build for everyone else.
4. **Review the generated SQL before committing.** Prisma occasionally generates a
   destructive step (a drop-and-recreate) where you expected an in-place alter.
5. **`prisma generate` runs automatically** via the `postinstall` script, so the
   client stays in sync after `npm install`.

## Commands

| Command | What it does | When |
| --- | --- | --- |
| `npm run db:status` | Shows applied vs pending migrations | Anytime; first thing to run when something looks wrong |
| `npm run db:migrate -- --name <name>` | Creates a migration from schema changes, applies it locally, regenerates the client | Every schema change, in development |
| `npm run db:deploy` | Applies pending migrations without generating new ones | CI / staging / production |
| `npm run db:reset` | **Destructive.** Drops the database, replays all migrations, runs the seed | Local only, when your dev data is disposable |
| `npm run db:studio` | Opens Prisma Studio to browse data | Debugging |
| `npm run db:generate` | Regenerates the Prisma client | After pulling someone else's schema change |

## Workflows

### Making a schema change

```bash
# Edit prisma/schema.prisma, then:
npm run db:migrate -- --name descriptive_name_here
npm run build          # confirm the app still compiles
git add prisma/ && git commit
```

Name migrations after *what they do*: `add_engagement_letter`,
`drop_commission_fields`, `index_booking_status`. Not `update`, `fix`, `changes`.

### Pulling someone else's schema change

```bash
git pull
npm install            # postinstall runs prisma generate
npm run db:migrate     # applies any pending migrations to your local db
```

If `db:migrate` reports drift, your local database has changes that are not in any
migration — usually from an earlier `db push`. Fix it with `npm run db:reset`
(destroys local data) rather than trying to reconcile by hand.

### Deploying

```bash
npm run db:deploy      # apply migrations
npm run build          # then build/start the app
```

`db:deploy` never generates migrations and never prompts. It only applies what is
already committed, which is what you want in CI.

## Things that go wrong

**`P3009: migrate found failed migrations`**
A migration failed partway. The database now holds a failed record and refuses to
continue. Locally: `npm run db:reset`. On a shared database: fix the underlying
cause, then `npx prisma migrate resolve --rolled-back <migration_name>` and deploy
again.

**Checksum mismatch**
Someone edited an already-applied migration file. Restore the original content
from git. If it genuinely must change, the correct fix is a *new* migration.

**Drift detected**
The database has changes no migration accounts for — almost always a stray
`db push`. Locally, reset. On a shared database, generate a catch-up migration:

```bash
npx prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script > prisma/migrations/<timestamp>_catchup/migration.sql
```

Then review that SQL carefully before applying it.

### Generating SQL by hand

If you ever need to produce SQL manually, note that **`prisma.config.ts` loads
dotenv, which prints a banner to stdout**. Redirecting `--script` straight to a
file captures that banner as line 1 and produces invalid SQL. Strip it:

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script 2>/dev/null \
  | sed '/^\[dotenv@/d' \
  | sed '/^Loaded Prisma config/d' \
  > migration.sql
```

Always test generated SQL against a scratch database before trusting it.

## Environment

`DATABASE_URL` lives in `.env`. Note there are two entries in that file — a
commented-out Neon URL and the active local one. The **last uncommented entry
wins**, so check which is active before assuming what you are connected to:

```bash
grep -n "DATABASE_URL" .env
```

Local development runs against `postgresql://localhost:5432/lawfinder`.

## History

This baseline was created on 2026-07-31 during the Phase 1a restructure.

The previous migration history was unusable: `0_init` created 22 tables and
contained no `Booking` table at all, while the schema had grown to ~40 models
including the entire consultation system. There was no `migration_lock.toml`, and
both existing migrations showed as *unapplied* even though the database had the
tables — so `migrate deploy` would have failed on `CREATE TABLE` for tables that
already existed. The project had been developed entirely with `db push`.

The fix: the stale migrations were deleted, a fresh `0_init` was generated from the
current schema (47 tables, 31 enums), and it was marked applied with
`prisma migrate resolve --applied 0_init` since the database already matched.

Verified by deploying to a clean database and confirming
`prisma migrate diff --from-config-datasource --to-schema` reports
**"No difference detected."**

See `docs/restructure/PROGRESS.md` for the wider restructure context.
