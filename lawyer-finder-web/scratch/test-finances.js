require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  try {
    console.log("1. Fetching paid invoices...");
    const paidInvoices = await prisma.invoice.findMany({
      where: { status: 'PAID' },
      select: { id: true, amount: true, paymentReason: true, lawyerId: true, createdAt: true },
    });
    console.log(`Paid invoices count: ${paidInvoices.length}`);

    console.log("2. Fetching ad campaigns...");
    const adCampaigns = await prisma.adCampaign.findMany({
      where: { status: { in: ['APPROVED', 'ACTIVE', 'EXPIRED'] } },
      select: { totalBudget: true, lawyerId: true },
    });
    console.log(`Ad campaigns count: ${adCampaigns.length}`);

    console.log("3. Fetching bookings...");
    const paidBookings = await prisma.booking.findMany({
      where: {
        paidAt: { not: null },
        status: { notIn: ['CANCELLED_BY_CLIENT', 'CANCELLED_BY_LAWYER', 'PENDING_PAYMENT', 'AWAITING_BANK_TRANSFER_VERIFICATION'] },
      },
      select: {
        id: true,
        lawyerFee: true,
        platformFee: true,
        totalAmount: true,
        lawyerId: true,
      },
    });
    console.log(`Paid bookings count: ${paidBookings.length}`);

    console.log("4. Fetching withdrawals...");
    const withdrawals = await prisma.withdrawRequest.findMany();
    console.log(`Withdrawals count: ${withdrawals.length}`);

    console.log("5. Fetching lawyers...");
    const lawyers = await prisma.lawyerProfile.findMany({
      select: {
        id: true,
        fullName: true,
        baslNumber: true,
        user: { select: { email: true } },
      },
    });
    console.log(`Lawyers count: ${lawyers.length}`);

    console.log("All queries completed successfully!");
  } catch (err) {
    console.error("Query failed with error:", err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run();
