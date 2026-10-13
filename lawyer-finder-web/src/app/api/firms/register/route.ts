import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { RegisterFirmSchema } from '@/schemas/firm.schema';
import { getFirmMembership } from '@/lib/firms/access';
import { allocateFirmSlug, createPracticeForAttorney } from '@/lib/firms/provisioning';
import {
  checkJoinEligibility,
  invitationExpiry,
  newInvitationToken,
} from '@/lib/firms/invitations';
import { canAddFirmMember } from '@/lib/firms/billing';
import { EmailService } from '@/lib/email/EmailService';

/**
 * Registering a real law firm.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PROBLEM THIS SOLVES. A multi-partner firm had no way to join. The only
 * route was: one partner registers as an individual attorney; a firm of one is
 * silently created and named after them; they find the firm console, rename it;
 * then they add partners one at a time, each of whom must already have
 * registered separately. Nobody would guess that, and the last step put people
 * inside a privilege boundary without asking them.
 *
 * TWO DESIGN DECISIONS WORTH KNOWING.
 *
 * 1. THIS CONVERTS THE FOUNDER'S EXISTING FIRM. It does not create a second one.
 *    Every attorney already has a firm of one, and that firm owns their matters,
 *    their subscription and their invoices. Creating a new firm and moving the
 *    attorney into it would leave `Booking.firmId` pointing at the old practice
 *    — which is the party the client actually engaged — so the matters would
 *    either be orphaned or silently re-pointed at a firm the client never chose.
 *    Renaming and filling out the firm they already have keeps every one of
 *    those relationships intact.
 *
 * 2. THE FOUNDER MUST BE A VERIFIED ATTORNEY. In Sri Lanka a law firm is a group
 *    of Attorneys-at-Law practising together; there is no lawful form in which a
 *    non-attorney founds a legal practice. Letting anyone register a "law firm"
 *    would also put an unlicensed legal-services provider into a public
 *    directory, which is the exact category the advertising rules refuse.
 *    See HOW-IT-WORKS.md Part 1 and LEGAL-GUARDRAILS.md.
 *
 * The registered practice goes to PENDING verification, so it does NOT appear in
 * the public directory until an administrator has checked it exists as claimed.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'LAWYER') {
      return NextResponse.json(
        {
          error:
            'Only an admitted Attorney-at-Law can register a practice. If you are an ' +
            'attorney, complete your own verification first — a law firm is a group of ' +
            'attorneys practising together, so the practice cannot exist before its ' +
            'principal does.',
        },
        { status: 403 }
      );
    }

    const profile = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, isVerified: true, fullName: true, firmId: true },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'You do not have an attorney profile on this platform yet.' },
        { status: 404 }
      );
    }

    if (!profile.isVerified) {
      return NextResponse.json(
        {
          error:
            'Your own BASL verification has not been completed yet. A practice is verified ' +
            'through its principal, so that has to come first.',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = RegisterFirmSchema.safeParse(body);
    if (!validated.success) {
      const first = validated.error.issues[0];
      return NextResponse.json(
        {
          error: first ? `${first.path.join('.')}: ${first.message}` : 'Check the form.',
          details: validated.error.format(),
        },
        { status: 400 }
      );
    }

    const data = validated.data;

    // The firm they already have, if any — an attorney approved before
    // 2026-10-13 has the firm of one created then, holding their matters, and
    // registering converts it. An attorney approved since has none: this is the
    // one place a practice is created, because registering it is their choice.
    const membership = await getFirmMembership(session.userId);
    let firmId = membership?.firmId ?? profile.firmId ?? null;

    if (!firmId) {
      firmId = await prisma.$transaction((tx) => createPracticeForAttorney(tx, profile.id));
    }

    if (!firmId) {
      return NextResponse.json(
        { error: 'Could not resolve your practice. Contact support.' },
        { status: 500 }
      );
    }

    const firm = await prisma.lawFirm.findUnique({
      where: { id: firmId },
      select: { id: true, name: true, slug: true, isRegisteredPractice: true },
    });

    if (!firm) {
      return NextResponse.json({ error: 'Could not resolve your practice.' }, { status: 500 });
    }

    // Only the principal may do this — it renames the practice every client
    // sees and admits people to it.
    if (membership && membership.role !== 'FIRM_OWNER') {
      return NextResponse.json(
        {
          error:
            'Only a principal of the practice can register or re-register it. Ask the ' +
            'partner who holds that role.',
        },
        { status: 403 }
      );
    }

    if (firm.isRegisteredPractice) {
      return NextResponse.json(
        {
          error: `${firm.name} is already registered. Change its details from the firm console instead.`,
        },
        { status: 409 }
      );
    }

    /**
     * Seats gate the INVITATIONS, not the registration.
     *
     * ─────────────────────────────────────────────────────────────────────────
     * This started as a hard 402 on the whole request, and driving the real flow
     * showed why that was wrong. A firm with no licence yet — which is every
     * firm before it chooses a plan — tried to register its practice and got
     * *"This firm has no active software licence, so no further people can be
     * given access."* They were not giving anyone access. They were typing in
     * the name of their firm.
     *
     * Registering is naming and describing the practice the attorney is already
     * working in. It consumes no seat: the founder already occupies theirs. So
     * registration proceeds, and any invitations are reported back as *not
     * sent*, with the reason.
     *
     * Silently dropping them would be worse than the 402 was — the principal
     * would believe their partners had been emailed. Hence `invitationsBlocked`
     * in the response and a warning the UI surfaces.
     *
     * The hard seat rule still bites where it means something: at ACCEPTANCE,
     * in /api/firms/invitations/respond, because a seat is consumed by a person
     * joining. Seats count PEOPLE WHO CAN SIGN IN, never matters, clients or
     * enquiries — see LEGAL-GUARDRAILS.md (rule 1).
     * ─────────────────────────────────────────────────────────────────────────
     */
    const seatCheck = await canAddFirmMember(firmId);
    const seatsAvailable = seatCheck.allowed;
    // Captured while the discriminated union still narrows; `seatCheck.reason`
    // only exists on the refusing branch.
    const seatRefusalReason = seatCheck.allowed ? null : seatCheck.reason;

    // Pre-flight every invitee so the principal gets one clear list of problems
    // rather than discovering them one acceptance at a time.
    const inviteeEmails = data.invitations.map((i) => i.email.toLowerCase().trim());
    if (new Set(inviteeEmails).size !== inviteeEmails.length) {
      return NextResponse.json(
        { error: 'The same email address appears more than once in the invitation list.' },
        { status: 400 }
      );
    }

    const existingUsers = await prisma.user.findMany({
      where: { email: { in: inviteeEmails } },
      select: { id: true, email: true },
    });
    const userByEmail = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u.id]));

    const problems: string[] = [];
    for (const invite of data.invitations) {
      const email = invite.email.toLowerCase().trim();
      const eligibility = await checkJoinEligibility({
        firmId,
        role: invite.role,
        userId: userByEmail.get(email) ?? null,
      });
      if (!eligibility.ok) problems.push(`${email}: ${eligibility.reason}`);
    }

    if (problems.length > 0) {
      return NextResponse.json(
        { error: 'Some of the people you listed cannot be invited yet.', problems },
        { status: 400 }
      );
    }

    // A practice with partners is a partnership. A practice registered by one
    // attorney with nobody else in it is still a sole practitioner, whatever the
    // form said — the schema should describe what is true.
    const willHaveOthers = data.invitations.length > 0;
    const firmType = willHaveOthers ? 'PARTNERSHIP' : data.firmType;

    const slug =
      firm.name.trim().toLowerCase() === data.name.trim().toLowerCase()
        ? firm.slug
        : await prisma.$transaction((tx) => allocateFirmSlug(tx, data.name));

    const result = await prisma.$transaction(async (tx) => {
      await tx.lawFirm.update({
        where: { id: firmId! },
        data: {
          name: data.name,
          slug,
          firmType,
          isSoloPractice: !willHaveOthers,
          registrationNumber: data.registrationNumber || null,
          establishedYear: data.establishedYear ?? null,
          description: data.description || null,
          practiceAreas: data.practiceAreas,
          languages: data.languages,
          courts: data.courts,
          district: data.district || null,
          contactEmail: data.contactEmail || null,
          contactPhone: data.contactPhone || null,
          websiteUrl: data.websiteUrl || null,
          officeHours: data.officeHours || null,

          isRegisteredPractice: true,
          registeredAt: new Date(),
          isActive: true,

          // Back into the queue. A registered practice makes a claim we have not
          // checked — that a firm of this name exists at this address with these
          // attorneys in it — and until an administrator confirms it, it does not
          // appear in the public directory (`GET /api/firms` lists VERIFIED only).
          verificationStatus: 'PENDING',
          verifiedAt: null,
          verificationNotes:
            'Registered by its principal and awaiting verification as a practice in its own right.',
        },
      });

      // The head office. Replaces the address-derived office the solo firm was
      // given at approval, rather than adding a second primary.
      await tx.firmOffice.updateMany({
        where: { firmId: firmId!, isPrimary: true },
        data: { isPrimary: false },
      });

      await tx.firmOffice.create({
        data: {
          firmId: firmId!,
          label: data.office.label || 'Head office',
          address: data.office.address,
          district: data.office.district || data.district || null,
          contactPhone: data.office.contactPhone || data.contactPhone || null,
          isPrimary: true,
        },
      });

      // Invitations — not memberships. Nobody is inside the privilege boundary
      // until they have said yes.
      const created: { email: string; token: string; role: string }[] = [];

      // Skipped entirely when the firm has no seat capacity, so that a practice
      // without a licence can still register itself. See the note above.
      for (const invite of seatsAvailable ? data.invitations : []) {
        const email = invite.email.toLowerCase().trim();
        const token = newInvitationToken();

        await tx.firmInvitation.upsert({
          where: { firmId_email: { firmId: firmId!, email } },
          update: {
            role: invite.role,
            title: invite.title || null,
            token,
            status: 'PENDING',
            invitedById: session.userId,
            expiresAt: invitationExpiry(),
            respondedAt: null,
            acceptedByUserId: null,
          },
          create: {
            firmId: firmId!,
            email,
            role: invite.role,
            title: invite.title || null,
            token,
            status: 'PENDING',
            invitedById: session.userId,
            expiresAt: invitationExpiry(),
          },
        });

        created.push({ email, token, role: invite.role });
      }

      return { created, slug };
    });

    // Notifications are outside the transaction: a mail failure must not undo a
    // registration that has already happened.
    for (const invite of result.created) {
      try {
        await EmailService.sendFirmInvitation({
          to: invite.email,
          firmName: data.name,
          invitedByName: profile.fullName,
          role: invite.role,
          token: invite.token,
        });
      } catch (error) {
        console.error('[FIRM_INVITE_EMAIL]', invite.email, error);
      }
    }

    const blocked = seatsAvailable ? [] : data.invitations.map((i) => i.email);

    return NextResponse.json(
      {
        success: true,
        firmId,
        slug: result.slug,
        invitationsSent: result.created.length,
        // Named explicitly rather than inferred from a count, so the UI cannot
        // quietly report success for people who were never emailed.
        invitationsBlocked: blocked,
        // `seatCheck.reason` already ends with what to do about it, so it is not
        // followed by a second instruction saying the same thing.
        warning:
          blocked.length > 0
            ? `Your practice is registered, but ${blocked.length} invitation${
                blocked.length === 1 ? ' was' : 's were'
              } not sent. ${seatRefusalReason ?? ''}`.trim()
            : null,
        verificationStatus: 'PENDING',
        note:
          'Your practice is registered and waiting to be verified. It will appear in the ' +
          'public directory once an administrator has confirmed it. Your existing matters, ' +
          'licence and invoices are unchanged — this renamed and completed the practice you ' +
          'were already working in rather than creating a second one.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[FIRM_REGISTER_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
