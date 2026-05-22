import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ConsultationPricingSchema } from '@/schemas/consultation.schema';

// GET: Fetch a lawyer's pricing
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lawyerId = searchParams.get('lawyerId');

    // If no lawyerId provided, get current lawyer's pricing
    const session = await getSession();
    const targetId = lawyerId || session?.profileId;

    if (!targetId) {
      return NextResponse.json({ error: 'Lawyer ID required' }, { status: 400 });
    }

    const pricing = await prisma.consultationPricing.findUnique({
      where: { lawyerId: targetId },
    });

    if (!pricing) {
      return NextResponse.json({ pricing: null, message: 'Pricing not configured yet' });
    }

    return NextResponse.json({ pricing });
  } catch {
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
        physicalPrice: validated.data.physicalPrice,
        onlinePrice: validated.data.onlinePrice,
        freeInitialConsultation: validated.data.freeInitialConsultation,
        freeConsultationDuration: validated.data.freeConsultationDuration,
        minAdvanceNoticeHours: validated.data.minAdvanceNoticeHours,
      },
      create: {
        lawyerId: session.profileId,
        pricingType: validated.data.pricingType as any,
        physicalPrice: validated.data.physicalPrice,
        onlinePrice: validated.data.onlinePrice,
        freeInitialConsultation: validated.data.freeInitialConsultation,
        freeConsultationDuration: validated.data.freeConsultationDuration,
        minAdvanceNoticeHours: validated.data.minAdvanceNoticeHours,
      },
    });

    return NextResponse.json({ success: true, pricing });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
