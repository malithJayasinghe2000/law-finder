import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const promos = await prisma.paidPromo.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        lawyer: {
          select: {
            fullName: true,
            baslNumber: true,
            district: true,
          },
        },
      },
    });

    return NextResponse.json({ promos }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await req.json();
    const { lawyerId, fromDate, toDate, status, paymentStatus, invoiceId } = body;

    if (!lawyerId || !fromDate || !toDate) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const promo = await prisma.paidPromo.create({
      data: {
        lawyerId,
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        status: status || 'INACTIVE',
        paymentStatus: paymentStatus || 'UNPAID',
        invoiceId: invoiceId || null,
      },
    });

    return NextResponse.json({ promo, message: 'Promo created successfully.' }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, status, paymentStatus, invoiceId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Promo ID required.' }, { status: 400 });
    }

    const updated = await prisma.paidPromo.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(paymentStatus && { paymentStatus }),
        ...(invoiceId !== undefined && { invoiceId }),
      },
    });

    return NextResponse.json({ promo: updated, message: 'Promo updated.' }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Promo ID required.' }, { status: 400 });
    }

    await prisma.paidPromo.delete({ where: { id } });

    return NextResponse.json({ message: 'Promo deleted.' }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
