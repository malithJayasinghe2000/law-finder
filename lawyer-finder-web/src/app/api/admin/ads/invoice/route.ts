import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/admin/ads/invoice — Generate an invoice for an ad campaign
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { campaignId } = await req.json();

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required.' }, { status: 400 });
    }

    const campaign = await prisma.adCampaign.findUnique({
      where: { id: campaignId },
      include: { lawyer: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    }

    if (campaign.invoiceId) {
      return NextResponse.json({ error: 'Invoice already exists for this campaign.' }, { status: 400 });
    }

    // Calculate amount
    let amount = 0;
    if (campaign.totalBudget) {
      amount = campaign.totalBudget;
    } else if (campaign.pricePerDay && campaign.startDate && campaign.endDate) {
      const days = Math.ceil(
        (new Date(campaign.endDate).getTime() - new Date(campaign.startDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      amount = campaign.pricePerDay * Math.max(1, days);
    } else {
      return NextResponse.json({ error: 'Cannot calculate invoice amount. Budget or price per day required.' }, { status: 400 });
    }

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        lawyerId: campaign.lawyerId,
        amount,
        status: 'PENDING',
        paymentReason: `Ad Campaign: ${campaign.name}`,
      },
    });

    // Update campaign with invoiceId
    await prisma.adCampaign.update({
      where: { id: campaignId },
      data: { invoiceId: invoice.id },
    });

    return NextResponse.json({ invoice, message: 'Invoice generated successfully.' });
  } catch (error) {
    console.error('[ADMIN_ADS_INVOICE]', error);
    return NextResponse.json({ error: 'Failed to generate invoice.' }, { status: 500 });
  }
}
