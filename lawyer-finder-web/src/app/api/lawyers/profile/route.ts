import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { profileSchema } from '@/schemas/profile.schema';

// GET: Fetch the logged-in lawyer's profile
export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'LAWYER' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const profile = await prisma.lawyerProfile.findFirst({
      where: { userId: session.userId },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    // Replaces the `inquiries` include removed in Phase 7 with the `Inquiry`
    // model. A COUNT, not the rows: the dashboard shows a number, and loading
    // every matter to compute one put the client's subject line and description
    // into a payload that only ever displayed a total.
    const openMatters = await prisma.booking.count({
      where: {
        lawyerId: profile.id,
        status: {
          notIn: [
            'COMPLETED',
            'DECLINED',
            'QUOTE_EXPIRED',
            'CLIENT_DECLINED',
            'CANCELLED_BY_CLIENT',
            'CANCELLED_BY_FIRM',
            'NO_SHOW',
          ],
        },
      },
    });

    return NextResponse.json({ ...profile, openMatters }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// PUT: Update the logged-in lawyer's profile
export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'LAWYER' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json();
    const validated = profileSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const profile = await prisma.lawyerProfile.findFirst({
      where: { userId: session.userId },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    const dataToUpdate: any = { ...validated.data };
    if (dataToUpdate.latitude !== undefined) {
      dataToUpdate.latitude = dataToUpdate.latitude === '' ? null : parseFloat(dataToUpdate.latitude);
    }
    if (dataToUpdate.longitude !== undefined) {
      dataToUpdate.longitude = dataToUpdate.longitude === '' ? null : parseFloat(dataToUpdate.longitude);
    }

    const updated = await prisma.lawyerProfile.update({
      where: { id: profile.id },
      data: dataToUpdate,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
