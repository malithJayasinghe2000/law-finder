import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ConsultationPricingSchema } from '@/schemas/consultation.schema';

// GET: the signed-in attorney's own settings.
//
// This used to take any `lawyerId` and answer without a session, returning the
// whole row — including the attorney's own bank account number — to anyone who
// had an attorney's id (profile ids appear in public directory URLs). Nothing
// calls it for another attorney, so it answers only for the person asking.
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER' || !session.profileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const targetId = session.profileId;

    const pricing = await prisma.consultationPricing.findUnique({
      where: { lawyerId: targetId },
    });

    if (!pricing) {
      return NextResponse.json({ pricing: null, message: 'Pricing not configured yet' });
    }

    return NextResponse.json({ pricing });
  } catch (e) {
    console.error('Error fetching pricing:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Set or update consultation pricing (LAWYER only)
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER' || !session.profileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validated = ConsultationPricingSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const pricing = await prisma.consultationPricing.upsert({
      where: { lawyerId: session.profileId },
      update: {
        pricingType: validated.data.pricingType as any,
        freeInitialConsultation: validated.data.freeInitialConsultation,
        freeConsultationDuration: validated.data.freeConsultationDuration,
        minAdvanceNoticeHours: validated.data.minAdvanceNoticeHours,
        bankName: validated.data.bankName,
        accountName: validated.data.accountName,
        accountNumber: validated.data.accountNumber,
        bankBranch: validated.data.bankBranch,
      },
      create: {
        lawyerId: session.profileId,
        pricingType: validated.data.pricingType as any,
        freeInitialConsultation: validated.data.freeInitialConsultation,
        freeConsultationDuration: validated.data.freeConsultationDuration,
        minAdvanceNoticeHours: validated.data.minAdvanceNoticeHours,
        bankName: validated.data.bankName,
        accountName: validated.data.accountName,
        accountNumber: validated.data.accountNumber,
        bankBranch: validated.data.bankBranch,
      },
    });

    return NextResponse.json({ success: true, pricing });
  } catch (e) {
    console.error('Error saving pricing:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
