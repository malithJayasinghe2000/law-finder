# Developer Guide: Database Setup & Prisma 7 ORM

This guide explains exactly how to run your local PostgreSQL database, connect it to the Next.js application using Prisma 7 standards.

## 1. Connecting to Local PostgreSQL (pgAdmin)

You do **not** need a cloud server to start developing. You can run PostgreSQL locally on your PC.

1. Download and install **PostgreSQL** and **pgAdmin**.
2. Open pgAdmin and create a new database called `lawfinder`.
3. Open the [.env](file:///d:/find%20law/lawyer-finder-web/.env) file in the root of the `lawyer-finder-web` folder.
4. Replace the `DATABASE_URL` with your local credentials. The format is:
   `postgresql://<USERNAME>:<PASSWORD>@localhost:5432/lawfinder?schema=public`

## 2. Managing the Database Schema (Prisma Migrations)

Prisma 7 has moved the connection URL out of schema.prisma and into prisma.config.ts. This was done automatically for you.

Since this project is targeting production, we use **Prisma Migrations** to safely manage database changes without risking data loss.

### Initial Setup & Applying Changes
When setting up the project for the first time, or after pulling new code, apply the latest migrations to your local database by running:
```bash
npx prisma migrate dev
```

### Making Schema Changes
Whenever you modify `prisma/schema.prisma` to add tables or columns, you must create a new migration. Run:
```bash
npx prisma migrate dev --name <describe_your_change>
```
*Note: Do not use `npx prisma db push` as it bypasses the migration history and can cause data loss.*

### Deploying to Production
When deploying to production or staging, **never** run `migrate dev`. Instead, apply your tracked migration files safely by running:
```bash
npx prisma migrate deploy
```

## 3. Seeding the Database (Test Accounts)

We have created an automated Seeder script that uses the `@prisma/adapter-pg` driver to connect securely.

Run:
```bash
npx prisma db seed
```

This will create:
*   **Admin:** `admin@lawfinder.lk` (Password: `password123`)
*   **Lawyer:** `lawyer@lawfinder.lk` (Password: `password123`)
*   **Client:** `citizen@lawfinder.lk` (Password: `password123`)

## 4. Troubleshooting
If you get an error about `PrismaClient` not being found, run:
```bash
npx prisma generate
```
Then try your commands again.
