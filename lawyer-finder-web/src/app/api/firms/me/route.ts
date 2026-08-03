import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  UpdateFirmSchema,
  UpdateFirmBankDetailsSchema,
} from '@/schemas/firm.schema';
import { getFirmMembership, canManageFirm } from '@/lib/firms/access';
import { getSeatAllowance } from '@/lib/firms/billing';
import { allocateFirmSlug } from '@/lib/firms/provisioning';

/**
 * The firm the signed-in user practises in.
 *
 * A solo practitioner has one of these whether they asked for it or not — it is
 * created for them on approval. The UI keeps firm management out of the way
 * until they add a second member, so nothing about their day changes.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 7).
 */

/** GET: the firm, its members and its offices. */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await getFirmMembership(session.userId);
    if (!membership) {
      return NextResponse.json({ firm: null, membership: null });
    }

    const firm = await prisma.lawFirm.findUnique({
      where: { id: membership.firmId },
      include: {
        offices: {
          where: { isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { label: 'asc' }],
        },
        members: {
          where: { status: { in: ['ACTIVE', 'INVITED', 'SUSPENDED'] } },
          orderBy: { joinedAt: 'asc' },
          select: {
            id: true,
            role: true,
            status: true,
            title: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                profileImageUrl: true,
                profile: {
                  select: { id: true, baslNumber: true, isVerified: true },
                },
              },
            },
          },
        },
      },
    });

    if (!firm) {
      return NextResponse.json({ error: 'Firm not found' }, { status: 404 });
    }

    const canManage = canManageFirm(membership);

    const seats = await getSeatAllowance(firm.id);

    return NextResponse.json({
      firm: {
        ...firm,
        // The firm's own bank details are only shown to those who administer the
        // firm. They are not secret from the client — a quote carries them — but
        // an unassigned paralegal has no reason to see them.
        bankName: canManage ? firm.bankName : null,
        accountName: canManage ? firm.accountName : null,
        accountNumber: canManage ? firm.accountNumber : null,
        bankBranch: canManage ? firm.bankBranch : null,
        taxIdentificationNumber: canManage ? firm.taxIdentificationNumber : null,
        vatNumber: canManage ? firm.vatNumber : null,
        isVatRegistered: firm.isVatRegistered,
        vatRatePercent: canManage ? firm.vatRatePercent : null,
        members: firm.members.map((m) => ({
          ...m,
          joinedAt: m.joinedAt.toISOString(),
        })),
        createdAt: firm.createdAt.toISOString(),
        updatedAt: firm.updatedAt.toISOString(),
        verifiedAt: firm.verifiedAt?.toISOString() ?? null,
        offices: firm.offices.map((o) => ({
          ...o,
          createdAt: o.createdAt.toISOString(),
          updatedAt: o.updatedAt.toISOString(),
        })),
      },
      membership: {
        role: membership.role,
        canManageFirm: canManage,
        isSoloPractice: firm.isSoloPractice,
      },
      // Seats are people who can sign in — never matters, clients or messages.
      // Surfaced so the firm console can say "4 of 5 seats used" before someone
      // hits a 402 trying to add a colleague. See src/lib/firms/billing.ts.
      seats,
    });
  } catch (error) {
    console.error('Firm read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH: update the firm profile, or its client-account details. */
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await getFirmMembership(session.userId);
    if (!membership) {
      return NextResponse.json({ error: 'You do not belong to a firm.' }, { status: 404 });
    }

    if (!canManageFirm(membership)) {
      return NextResponse.json(
        { error: 'Only a principal or practice manager can edit the firm.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const section = body?.section as string | undefined;

    if (section === 'bank') {
      const validated = UpdateFirmBankDetailsSchema.safeParse(body);
      if (!validated.success) {
        return NextResponse.json({ error: validated.error.format() }, { status: 400 });
      }

      const firm = await prisma.lawFirm.update({
        where: { id: membership.firmId },
        data: {
          bankName: validated.data.bankName || null,
          accountName: validated.data.accountName || null,
          accountNumber: validated.data.accountNumber || null,
          bankBranch: validated.data.bankBranch || null,

          // Printed on the firm's own fee notes.
          taxIdentificationNumber: validated.data.taxIdentificationNumber || null,
          vatNumber: validated.data.vatNumber || null,
          isVatRegistered: validated.data.isVatRegistered ?? false,
          vatRatePercent: validated.data.isVatRegistered
            ? validated.data.vatRatePercent ?? null
            : null,
        },
        select: { id: true },
      });

      return NextResponse.json({ success: true, firmId: firm.id });
    }

    const validated = UpdateFirmSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const d = validated.data;

    const existing = await prisma.lawFirm.findUnique({
      where: { id: membership.firmId },
      select: { name: true, slug: true, verificationStatus: true },
    });

    // Renaming the firm moves its public URL, so allocate a fresh slug rather
    // than leaving the old name in the address bar.
    const slug =
      existing && existing.name !== d.name
        ? await allocateFirmSlug(prisma, d.name)
        : undefined;

    // Changing who the firm says it is invalidates our check of who it is. A
    // verified firm that renames itself goes back into the queue rather than
    // carrying a verification badge earned under another name.
    const resetVerification =
      existing?.verificationStatus === 'VERIFIED' && existing.name !== d.name;

    const firm = await prisma.lawFirm.update({
      where: { id: membership.firmId },
      data: {
        name: d.name,
        firmType: d.firmType,
        registrationNumber: d.registrationNumber || null,
        establishedYear: d.establishedYear ?? null,
        description: d.description || null,
        practiceAreas: d.practiceAreas,
        languages: d.languages,
        courts: d.courts,
        district: d.district || null,
        contactEmail: d.contactEmail || null,
        contactPhone: d.contactPhone || null,
        websiteUrl: d.websiteUrl || null,
        officeHours: d.officeHours || null,
        logoUrl: d.logoUrl || null,
        ...(slug ? { slug } : {}),
        ...(resetVerification
          ? {
              verificationStatus: 'PENDING' as const,
              verifiedAt: null,
              verificationNotes:
                'Re-verification required: the firm changed its registered name.',
            }
          : {}),
      },
      select: { id: true, slug: true, verificationStatus: true },
    });

    return NextResponse.json({ success: true, firm });
  } catch (error) {
    console.error('Firm update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
