/**
 * Delete AI conversations past their retention period.
 *
 * Run with: npm run ai:purge          (reports and deletes)
 *           npm run ai:purge -- --dry (reports only)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What is being deleted, and why there is a period at all.
 *
 * These rows are people's questions about their legal problems. That is
 * sensitive personal data under the Personal Data Protection Act No. 9 of 2022,
 * and where someone is describing a dispute in order to understand their
 * position it can be the same material that would attract privilege in an
 * attorney's hands.
 *
 * We keep it for exactly one reason: a signed-in user expects their chat history
 * to still be there. So the period is the shortest one that delivers that, and
 * it counts from `updatedAt` — last use, not creation — so a conversation
 * someone is still using is never deleted underneath them.
 *
 * Guest conversations do not appear here because they are never written. See
 * `persist()` in src/app/api/ai/ask/route.ts.
 *
 * This is the floor, not the finished article. Phase 6 owns PDPA properly:
 * lawful basis, subject access, erasure on request, and a processor agreement
 * with each firm. Wire this into a scheduled job then, if not before.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import prisma from '../src/lib/db';
import { AI_CONVERSATION_RETENTION_DAYS, retentionCutoff } from '../src/lib/ai/policy';

async function main() {
  const dryRun = process.argv.includes('--dry');
  const cutoff = retentionCutoff();

  console.log(
    `\nAI conversation retention: ${AI_CONVERSATION_RETENTION_DAYS} days from last use.`
  );
  console.log(`Cutoff: anything not touched since ${cutoff.toISOString()}\n`);

  const stale = await prisma.aiConversation.findMany({
    where: { updatedAt: { lt: cutoff } },
    select: {
      id: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  if (stale.length === 0) {
    console.log('Nothing to purge.\n');
    return;
  }

  const messageCount = stale.reduce((n, c) => n + c._count.messages, 0);
  console.log(
    `${stale.length} conversation(s), ${messageCount} message(s) past retention.`
  );

  if (dryRun) {
    console.log('\n--dry given: nothing deleted.\n');
    return;
  }

  // Messages go with the conversation via onDelete: Cascade.
  const { count } = await prisma.aiConversation.deleteMany({
    where: { updatedAt: { lt: cutoff } },
  });

  console.log(`\nDeleted ${count} conversation(s) and their messages.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Purge failed:', error);
    process.exit(1);
  });
