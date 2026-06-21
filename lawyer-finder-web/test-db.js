require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  try {
    const count = await prisma.lawyerProfile.count();
    console.log("Total lawyer profiles in DB:", count);
    if (count > 0) {
      const lawyers = await prisma.lawyerProfile.findMany({
        select: {
          id: true,
          fullName: true,
          isVerified: true,
          languages: true,
        }
      });
      console.log("Lawyers details:", lawyers);
    }
  } catch (err) {
    console.error("Database query failed:", err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run();
