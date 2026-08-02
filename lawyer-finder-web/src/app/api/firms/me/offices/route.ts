import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { FirmOfficeSchema } from '@/schemas/firm.schema';
import { getFirmMembership, canManageFirm } from '@/lib/firms/access';

/**
 * A firm's offices.
 *
 * A firm may practise from more than one address. Each attorney still keeps
 * their own calendar — offices are places, not schedules, and availability is
 * never collapsed to the firm.
 */

async function requireFirmAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'LAWYER') {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const membership = await getFirmMembership(session.userId);
  if (!canManageFirm(membership)) {
    return {
      error: NextResponse.json(
        { error: 'Only a principal or practice manager can change firm offices.' },
        { status: 403 }
      ),
    };
  }

  return { session, membership: membership! };
}

/** POST: add an office. */
export async function POST(req: Request) {
  try {
    const auth = await requireFirmAdmin();
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const validated = FirmOfficeSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const d = validated.data;

    const office = await prisma.$transaction(async (tx) => {
      if (d.isPrimary) {
        await tx.firmOffice.updateMany({
          where: { firmId: auth.membership.firmId },
          data: { isPrimary: false },
        });
      }

      return tx.firmOffice.create({
        data: {
          firmId: auth.membership.firmId,
          label: d.label,
          address: d.address,
          district: d.district || null,
          contactPhone: d.contactPhone || null,
          isPrimary: d.isPrimary,
        },
      });
    });

    return NextResponse.json({ success: true, office }, { status: 201 });
  } catch (error) {
    console.error('Add firm office error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH: edit an office, or retire it. Offices are soft-deleted. */
export async function PATCH(req: Request) {
  try {
    const auth = await requireFirmAdmin();
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const officeId = body?.officeId;

    if (typeof officeId !== 'string') {
      return NextResponse.json({ error: 'officeId is required.' }, { status: 400 });
    }

    const office = await prisma.firmOffice.findUnique({
      where: { id: officeId },
      select: { id: true, firmId: true },
    });

    if (!office || office.firmId !== auth.membership.firmId) {
      return NextResponse.json({ error: 'Office not found.' }, { status: 404 });
    }

    // Retire rather than delete — an old address may still appear on an
    // engagement letter issued while the firm sat there.
    if (body.isActive === false) {
      await prisma.firmOffice.update({
        where: { id: officeId },
        data: { isActive: false, isPrimary: false },
      });
      return NextResponse.json({ success: true });
    }

    const validated = FirmOfficeSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const d = validated.data;

    await prisma.$transaction(async (tx) => {
      if (d.isPrimary) {
        await tx.firmOffice.updateMany({
          where: { firmId: auth.membership.firmId },
          data: { isPrimary: false },
        });
      }

      await tx.firmOffice.update({
        where: { id: officeId },
        data: {
          label: d.label,
          address: d.address,
          district: d.district || null,
          contactPhone: d.contactPhone || null,
          isPrimary: d.isPrimary,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update firm office error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
