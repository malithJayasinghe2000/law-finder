import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET: Retrieve lawyer withdrawal stats and past requests
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER') {
      return NextResponse.json({ error: 'Unauthorized. Lawyer access required.' }, { status: 401 });
    }

    const lawyer = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!lawyer) {
      return NextResponse.json({ error: 'Lawyer profile not found' }, { status: 404 });
    }

    // 1. Fetch all bookings that are paid/confirmed/completed
    const bookings = await prisma.booking.findMany({
      where: {
        lawyerId: lawyer.id,
        status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] },
        paidAt: { not: null },
      },
      select: {
        id: true,
        bookingNumber: true,
        date: true,
        startTime: true,
        endTime: true,
        lawyerFee: true,
        totalAmount: true,
        status: true,
        client: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    const totalEarnings = bookings.reduce((sum, b) => sum + b.lawyerFee, 0);

    // 2. Fetch all withdraw requests
    const withdrawals = await prisma.withdrawRequest.findMany({
      where: { lawyerId: lawyer.id },
      orderBy: { createdAt: 'desc' },
    });

    const totalPaid = withdrawals
      .filter((w) => w.status === 'APPROVED')
      .reduce((sum, w) => sum + w.amount, 0);

    const totalPending = withdrawals
      .filter((w) => w.status === 'PENDING')
      .reduce((sum, w) => sum + w.amount, 0);

    const withdrawableBalance = totalEarnings - totalPaid - totalPending;

    return NextResponse.json({
      success: true,
      stats: {
        totalEarnings,
        totalPaid,
        totalPending,
        withdrawableBalance,
      },
      withdrawals,
      bookings: bookings.map((b) => ({
        ...b,
        date: b.date.toISOString().split('T')[0],
      })),
    });
  } catch (error: any) {
    console.error('Failed to get withdrawals:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error', stack: error?.stack }, { status: 500 });
  }
}

// POST: Request a withdrawal
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER') {
      return NextResponse.json({ error: 'Unauthorized. Lawyer access required.' }, { status: 401 });
    }

    const lawyer = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!lawyer) {
      return NextResponse.json({ error: 'Lawyer profile not found' }, { status: 404 });
    }

    const body = await req.json();
    const { amount, bankName, accountNumber, accountHolder } = body;

    if (!amount || amount <= 0 || !bankName || !accountNumber || !accountHolder) {
      return NextResponse.json({ error: 'All fields (amount, bankName, accountNumber, accountHolder) are required.' }, { status: 400 });
    }

    // 1. Calculate available balance
    const bookings = await prisma.booking.findMany({
      where: {
        lawyerId: lawyer.id,
        status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] },
        paidAt: { not: null },
      },
      select: {
        lawyerFee: true,
      },
    });

    const totalEarnings = bookings.reduce((sum, b) => sum + b.lawyerFee, 0);

    const withdrawals = await prisma.withdrawRequest.findMany({
      where: { lawyerId: lawyer.id },
    });

    const totalPaid = withdrawals
      .filter((w) => w.status === 'APPROVED')
      .reduce((sum, w) => sum + w.amount, 0);

    const totalPending = withdrawals
      .filter((w) => w.status === 'PENDING')
      .reduce((sum, w) => sum + w.amount, 0);

    const withdrawableBalance = totalEarnings - totalPaid - totalPending;

    if (amount > withdrawableBalance) {
      return NextResponse.json({ error: `Insufficient balance. You can withdraw up to LKR ${withdrawableBalance}.` }, { status: 400 });
    }

    // 2. Create withdrawal request
    const withdrawRequest = await prisma.withdrawRequest.create({
      data: {
        lawyerId: lawyer.id,
        amount,
        bankName,
        accountNumber,
        accountHolder,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      withdrawRequest,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to request withdrawal:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error', stack: error?.stack }, { status: 500 });
  }
}
