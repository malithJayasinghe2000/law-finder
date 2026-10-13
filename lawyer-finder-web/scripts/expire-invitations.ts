/**
 * Expire invitations that have run out.
 *
 * Run with: npm run invitations:expire   (part of jobs:daily)
 *
 * Both kinds are also expired lazily when someone opens them, but a link nobody
 * opens would otherwise keep a client's legal problem — encrypted — in a
 * client-request invitation for ever. Expiring wipes that text.
 * See src/lib/firms/clientIntake.ts.
 */
import prisma from '@/lib/db';
import { expireStaleInvitations } from '@/lib/firms/invitations';
import { expireStaleClientIntakes } from '@/lib/firms/clientIntake';

async function main() {
  const firm = await expireStaleInvitations();
  const client = await expireStaleClientIntakes();
  console.log(`Expired ${firm} firm invitation(s) and ${client} client request(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
