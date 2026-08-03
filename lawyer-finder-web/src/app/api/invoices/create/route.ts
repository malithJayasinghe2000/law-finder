import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getFirmMembership, canManageFirm } from '@/lib/firms/access';
import { getSession } from '@/lib/auth';
import { CreateInvoiceSchema } from '@/schemas/subscription.schema';
import { EmailService } from '@/lib/email/EmailService';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    // Check if authorized
    if (!session || session.role !== 'LAWYER') {
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

    // Get lawyer profile
    const lawyerProfile = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
    });

    if (!lawyerProfile) {
      return NextResponse.json({ error: 'Lawyer profile not found' }, { status: 404 });
    }

    // The licence is the FIRM's, not this attorney's (Phase 3).
    if (!lawyerProfile.firmId) {
      return NextResponse.json({ error: 'This attorney is not linked to a firm.' }, { status: 404 });
    }
    const firmId = lawyerProfile.firmId;

    // Only a principal may commit the practice to a licence. Any attorney could
    // previously buy one, because the subscription was theirs; now it binds the
    // whole firm and every seat in it, so it is a decision for whoever runs the
    // practice.
    const membership = await getFirmMembership(session.userId);
    if (!membership || membership.firmId !== firmId || !canManageFirm(membership)) {
      return NextResponse.json(
        { error: 'Only the firm\'s principal or practice manager can change the firm\'s software licence.' },
        { status: 403 }
      );
    }

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
        lawyerId: lawyerProfile.id,
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

    // Fetch lawyer user details for the email
    const lawyerUser = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (lawyerUser?.email) {
      EmailService.sendInvoiceCreated(
        lawyerUser.email,
        lawyerUser.fullName || 'Valued Lawyer',
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

