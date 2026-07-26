const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const docs = await prisma.legalDocument.findMany({
      select: {
        id: true,
        title: true,
        fileName: true,
        ragDocumentName: true,
        status: true
      }
    });
    console.log("Documents in DB:", JSON.stringify(docs, null, 2));
  } catch (err) {
    console.error("Query failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
