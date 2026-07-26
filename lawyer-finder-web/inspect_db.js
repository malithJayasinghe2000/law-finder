const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const invoices = await prisma.invoice.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
  });
  console.log('--- RECENT INVOICES ---');
  console.log(JSON.stringify(invoices, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
