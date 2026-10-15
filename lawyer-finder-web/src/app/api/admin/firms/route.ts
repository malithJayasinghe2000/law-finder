import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { VerifyFirmSchema } from '@/schemas/firm.schema';
import { LISTED_FIRM_WHERE, AWAITING_CHECK_FIRM_WHERE, isListedFirm, isPublicDirectoryEnabled } from '@/lib/directory';

/**
 * The page's tabs. "Verified" used to be a status filter, and showed four
 * firms of one that never registered as verified, though only registered,
 * verified practices are listed. Each view is now what an admin acts on.
 */
const VIEWS = {
  waiting: AWAITING_CHECK_FIRM_WHERE,
  listed: LISTED_FIRM_WHERE,
  'not-verified': { isRegisteredPractice: true, verificationStatus: 'REJECTED' },
  'not-registered': { isRegisteredPractice: false },
  all: {},
} as const;

/** Whether the firm is listed and, if not, why — in the admin's words. */
function listingState(f: { isActive: boolean; isRegisteredPractice: boolean; verificationStatus: string }) {
  if (isListedFirm(f)) return 'LISTED';
  if (!f.isRegisteredPractice) return 'NOT_REGISTERED';
  if (!f.isActive) return 'INACTIVE';
  if (f.verificationStatus === 'REJECTED') return 'NOT_VERIFIED';
  return 'WAITING';
}

/**
 * Platform-side firm verification.
 *
 * Verifying a firm means confirming that a practice exists, at the address it
 * claims, with a named principal who is an admitted Attorney-at-Law. It is a
 * different check from `LawyerProfile.isVerified`, which is about one person's
 * BASL registration — a firm of five verified attorneys is not automatically a
 * verified firm, and a verified firm does not vouch for anyone's admission.
 *
 * Note what an ADMIN can see here: firm registration details and membership.
 * Never a matter, never a matter description. That boundary is enforced in
 * src/lib/firms/access.ts and does not have an exception for this screen.
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 5).
 */

/** GET: firms awaiting or holding a verification decision. */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const view = (searchParams.get('view') || 'waiting') as keyof typeof VIEWS;
    const search = searchParams.get('search') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10));

    const where: Record<string, unknown> = { ...(VIEWS[view] ?? VIEWS.waiting) };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [firms, total] = await Promise.all([
      prisma.lawFirm.findMany({
        where,
        select: {
          id: true,
          slug: true,
          name: true,
          firmType: true,
          isSoloPractice: true,
          isActive: true,
          isRegisteredPractice: true,
          registrationNumber: true,
          principalBaslNumber: true,
          district: true,
          contactEmail: true,
          contactPhone: true,
          establishedYear: true,
          verificationStatus: true,
          verifiedAt: true,
          verificationNotes: true,
          createdAt: true,
          offices: {
            where: { isActive: true },
            select: { label: true, address: true, district: true, isPrimary: true },
          },
          members: {
            where: { status: 'ACTIVE' },
            select: {
              role: true,
              title: true,
              user: {
                select: {
                  fullName: true,
                  email: true,
                  profile: { select: { fullName: true, baslNumber: true, isVerified: true } },
                },
              },
            },
          },
          _count: { select: { lawyers: true, bookings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lawFirm.count({ where }),
    ]);
    const directoryOn = await isPublicDirectoryEnabled();

    return NextResponse.json({
      firms: firms.map((f) => ({
        ...f,
        listing: listingState(f),
        attorneyCount: f._count.lawyers,
        // A count, deliberately — not a list, and never a subject line.
        matterCount: f._count.bookings,
        _count: undefined,
        createdAt: f.createdAt.toISOString(),
        verifiedAt: f.verifiedAt?.toISOString() ?? null,
      })),
      directoryOn,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Admin firms error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

/** PATCH: record a verification decision. */
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await req.json();
    const validated = VerifyFirmSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const { firmId, decision, notes } = validated.data;

    const firm = await prisma.lawFirm.findUnique({
      where: { id: firmId },
      select: {
        id: true,
        isRegisteredPractice: true,
        members: { where: { status: 'ACTIVE', role: 'FIRM_OWNER' }, select: { id: true } },
      },
    });

    if (!firm) {
      return NextResponse.json({ error: 'Firm not found.' }, { status: 404 });
    }

    // Only a registered practice is listed (LISTED_FIRM_WHERE), so a decision
    // on one that never registered changes nothing a client sees and only
    // makes the record say "verified" about a check nobody could make.
    // Registering puts the practice back to PENDING for a real decision.
    if (!firm.isRegisteredPractice) {
      return NextResponse.json(
        { error: 'This practice has not registered, so there is nothing to verify yet.' },
        { status: 409 }
      );
    }

    // A practice with nobody answerable for it cannot be verified.
    if (decision === 'VERIFIED' && firm.members.length === 0) {
      return NextResponse.json(
        { error: 'This firm has no active principal. It cannot be verified.' },
        { status: 400 }
      );
    }

    if (decision === 'REJECTED' && !notes) {
      return NextResponse.json(
        { error: 'Give a reason when rejecting a firm — they are entitled to know it.' },
        { status: 400 }
      );
    }

    await prisma.lawFirm.update({
      where: { id: firmId },
      data: {
        verificationStatus: decision,
        verifiedAt: decision === 'VERIFIED' ? new Date() : null,
        verifiedById: session.userId,
        verificationNotes: notes || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Firm verification error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
