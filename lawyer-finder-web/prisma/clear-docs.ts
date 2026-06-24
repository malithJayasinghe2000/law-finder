import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== Clearing PostgreSQL Legal Documents ===");
  const count = await prisma.legalDocument.deleteMany({});
  console.log(`✔ Deleted ${count.count} document records from PostgreSQL.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
