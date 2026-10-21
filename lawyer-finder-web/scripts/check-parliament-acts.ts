/**
 * Check Parliament's Acts listing for new Acts and queue them for review.
 *
 * Run with: npm run library:check-parliament           (part of jobs:weekly)
 *           npm run library:check-parliament -- 40     (read up to 40 pages: a backfill)
 *
 * Queues only; nothing reaches the library or the AI until an admin approves
 * it under Admin > Legal Documents > New from Parliament. See src/lib/parliamentActs.ts.
 */
import prisma from '@/lib/db';
import { checkParliament } from '@/lib/parliamentActs';

async function main() {
  const pages = Math.max(1, Number(process.argv[2]) || 5);
  const r = await checkParliament(pages);
  console.log(
    `Read ${r.pagesRead} page(s): ${r.added} new Act(s) queued` +
      (r.withoutPdf ? `, ${r.withoutPdf} listed without a PDF (skipped)` : '') +
      (r.complete
        ? `. Up to date; ${r.lawsMarkedChecked} law(s) marked checked.`
        : '. Stopped before reaching Acts seen earlier: run again with more pages. No law was marked checked.')
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
