import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getFirmMembership, canManageFirm } from '@/lib/firms/access';
import { getSession } from '@/lib/auth';
import { CreateInvoiceSchema } from '@/schemas/subscription.schema';
import { EmailService } from '@/lib/email/EmailService';
import { LICENSING_ENABLED } from '@/lib/licensing';

export async function POST(req: NextRequest) {
  // Nobody is billed, and nobody pays us, while licensing is off for launch —
  // not even through an old link (src/lib/licensing.ts).
  if (!LICENSING_ENABLED) {
    return NextResponse.json({ error: 'Licences are not sold yet.' }, { status: 410 });
  }

  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('Create invoice request body:', JSON.stringify(body, null, 2));
    const validation = CreateInvoiceSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      console.error('Validation errors:', errors);
      return NextResponse.json(
        { error: `Validation failed: ${errors}` },
        { status: 400 }
      );
    }

    const { planId, billingCycle } = validation.data;

    // The licence belongs to the FIRM (Phase 3), so the firm is resolved from the
    // buyer's MEMBERSHIP and not from a LawyerProfile.
    //
    // This route used to require `session.role === 'LAWYER'` and then look the
    // buyer up in `lawyerProfile`. That contradicted its own error message: a
    // practice manager is a FIRM_ADMIN who need not be an admitted attorney and
    // may have no LawyerProfile at all, so the person the message named could
    // never reach it — they got 401 or 404 instead. Membership is the right
    // source of truth here; `canManageFirm` already decides who may commit the
    // practice to a licence.
    const membership = await getFirmMembership(session.userId);

    if (!membership) {
      return NextResponse.json(
        { error: 'You do not belong to a firm, so there is no practice to license.' },
        { status: 404 }
      );
    }

    if (!canManageFirm(membership)) {
      return NextResponse.json(
        { error: 'Only the firm\'s principal or practice manager can change the firm\'s software licence.' },
        { status: 403 }
      );
    }

    const firmId = membership.firmId;

    // Display and audit only — `Invoice.firmId` records the party actually being
    // billed. Null where the buyer is not an admitted attorney.
    const raisedByProfileId = membership.profileId;

    // One live licence per firm.
    const existingActiveSubscription = await prisma.subscription.findFirst({
      where: {
        firmId,
        status: { in: ['ACTIVE', 'PAST_DUE'] },
      },
    });

    if (existingActiveSubscription) {
      return NextResponse.json(
        { error: 'This firm already has an active or pending licence. Cancel it first or wait for it to expire.' },
        { status: 400 }
      );
    }

    // Get the subscription plan
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Get the role for this plan tier
    const role = await prisma.subscriptionRole.findUnique({
      where: { name: plan.tier },
    });

    if (!role) {
      return NextResponse.json({ error: 'Role not found for this plan' }, { status: 404 });
    }

    // Calculate amount and dates based on billing cycle
    const amount = billingCycle === 'YEARLY' ? plan.yearlyAmount : plan.monthlyAmount;
    const now = new Date();
    const endDate = billingCycle === 'YEARLY'
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const nextBilling = new Date(endDate);

    // Create subscription with PAST_DUE status (will become ACTIVE after payment approval)
    const subscription = await prisma.subscription.create({
      data: {
        firmId,
        planId: planId,
        roleId: role.id,
        status: 'PAST_DUE',
        billingCycle: billingCycle,
        startDate: now,
        endDate: endDate,
        nextBilling: nextBilling,
        autoRenew: true,
      },
      include: {
        plan: true,
        role: true,
      },
    });

    // Now create invoice and link it to subscription
    const invoice = await prisma.invoice.create({
      data: {
        // Billed to the firm; `lawyerId` records who raised it.
        firmId,
        lawyerId: raisedByProfileId,
        planId: planId,
        subscriptionId: subscription.id,
        amount: amount,
        status: 'PENDING',
        paymentReason: `${plan.name} - ${billingCycle} subscription payment`,
      },
      include: {
        plan: true,
      },
    });

    // Update subscription to link invoice
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        invoiceId: invoice.id,
      },
      include: {
        plan: true,
        role: true,
      },
    });

    // The person who raised it gets the invoice email. They are not necessarily
    // an attorney, so the fallback greeting must not assume one.
    const buyer = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (buyer?.email) {
      EmailService.sendInvoiceCreated(
        buyer.email,
        buyer.fullName || membership.firmName,
        invoice.id,
        invoice.amount,
        invoice.paymentReason,
        billingCycle
      ).catch(err => console.error('Failed to send invoice creation email:', err));
    }

    return NextResponse.json(
      {
        invoice: {
          id: invoice.id,
          amount: invoice.amount,
          status: invoice.status,
          planName: invoice.plan?.name || plan.name,
          createdAt: invoice.createdAt,
        },
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          billingCycle: updatedSubscription.billingCycle,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

