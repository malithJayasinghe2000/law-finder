/**
 * Delete personal data past its retention period.
 *
 * Run with: npm run privacy:purge          (reports and deletes)
 *           npm run privacy:purge -- --dry (reports only)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * This script has no policy of its own. Every period, and every decision about
 * what may be touched at all, comes from `src/lib/privacy/policy.ts` — change
 * the schedule there, not here.
 *
 * THE THING THIS SCRIPT MUST NEVER DO.
 *
 * Delete matter data. `Booking`, `ConflictCheck`, `Quote`, `EngagementLetter`,
 * `FeeNote`, `BookingPayment` and client-attorney `Message` belong to the FIRM.
 * We hold them as processor. A retention job that quietly deleted a firm's
 * conflict-check records would destroy evidence the firm is professionally
 * required to keep — and we would have done it on our own authority, which is
 * precisely what a processor may not do.
 *
 * `assertPurgeable()` refuses those models, and this script calls it for every
 * rule before touching anything. It is not decoration: the whole reason this
 * runs unattended is that it cannot reach the data that would matter.
 *
 * It supersedes `npm run ai:purge`, which remains as a narrower tool for the AI
 * conversations alone.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import prisma from '@/lib/db';
import {
  RETENTION_SCHEDULE,
  assertPurgeable,
  retentionCutoff,
  firmRetentionIsUndecided,
  FIRM_CONTROLLED_MODELS,
} from '@/lib/privacy/policy';

async function main() {
  const dryRun = process.argv.includes('--dry');
  const now = new Date();

  console.log(`\nRetention purge${dryRun ? ' (dry run — nothing will be deleted)' : ''}`);
  console.log(`Now: ${now.toISOString()}\n`);

  let total = 0;
  const refused: string[] = [];

  for (const rule of RETENTION_SCHEDULE) {
    const purgeable = assertPurgeable(rule.model);

    if (!purgeable.ok) {
      // A rule in the schedule that the guard refuses is a contradiction in the
      // policy file, not a condition to work around. Report and skip.
      refused.push(`${rule.model}: ${purgeable.reason}`);
      continue;
    }

    const cutoff = retentionCutoff(rule.days, now);

    // Data-driven over model names, so the cast is unavoidable here. The set of
    // names it can hold is fixed by RETENTION_SCHEDULE and gated by
    // assertPurgeable above.
    const delegate = (prisma as unknown as Record<string, {
      count: (args: unknown) => Promise<number>;
      deleteMany: (args: unknown) => Promise<{ count: number }>;
    }>)[rule.model];

    if (!delegate) {
      refused.push(`${rule.model}: no such Prisma model — the schedule names something that does not exist`);
      continue;
    }

    const where = { [rule.timestampField]: { lt: cutoff } };
    const matched = await delegate.count({ where });

    if (matched === 0) {
      console.log(`  ${rule.model.padEnd(20)} 0 rows older than ${rule.days}d`);
      continue;
    }

    if (dryRun) {
      console.log(`  ${rule.model.padEnd(20)} ${matched} rows WOULD be deleted (older than ${rule.days}d by ${rule.timestampField})`);
    } else {
      const { count } = await delegate.deleteMany({ where });
      console.log(`  ${rule.model.padEnd(20)} ${count} rows deleted (older than ${rule.days}d by ${rule.timestampField})`);
    }

    total += matched;
  }

  if (refused.length) {
    console.error('\nREFUSED — the schedule and the guard disagree:');
    for (const r of refused) console.error(`  ${r}`);
    console.error('\nFix src/lib/privacy/policy.ts. Exiting non-zero.\n');
    process.exit(1);
  }

  console.log(`\n${total} rows ${dryRun ? 'would be' : ''} affected in total.`);

  // Say the quiet part every run, so the gap does not become invisible once the
  // script is green and scheduled.
  if (firmRetentionIsUndecided()) {
    console.log(
      '\nNOT TOUCHED — matter data the firm controls:\n' +
        `  ${FIRM_CONTROLLED_MODELS.join(', ')}\n` +
        '  How long a matter file and a conflict-check record must be kept is the\n' +
        '  firm\'s professional duty, not our schedule. That is counsel question\n' +
        '  7(c), still unanswered. Until it is, nothing here expires automatically.\n'
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
