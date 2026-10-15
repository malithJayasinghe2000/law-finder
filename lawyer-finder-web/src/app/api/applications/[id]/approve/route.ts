import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { EmailService } from '@/lib/email/EmailService';
import { fullApplicationSchema, APPROVED_DRAFT_STUB } from '@/schemas/application.schema';

/**
 * Approving an attorney application.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS ROUTE USED TO DO, AND WHY IT MATTERED.
 *
 * It read the draft as `any` and filled every gap with a default:
 *
 *     fullName:   data.step1?.fullName || 'Verified Lawyer'
 *     baslNumber: data.step2?.baslNumber || `BASL-MANUAL-${Date.now()}`
 *
 * The second one is the serious one. `LawyerProfile.isVerified` was then set to
 * `true` in the same statement — so an application missing its registration
 * number produced an attorney marked as verified against a BASL number that we
 * had invented, appearing in a public directory under it. "Verified" means we
 * checked this person's BASL registration; a fabricated number makes that claim
 * false on the one field it is a claim about.
 *
 * Now the draft is parsed with the real schema and approval REFUSES if it does
 * not pass. An administrator cannot approve an incomplete application, which is
 * the correct behaviour — the fix for a missing BASL number is to ask for it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const STEP_NAMES: Record<string, string> = {
  step1: 'personal details',
  step2: 'professional credentials',
  step3: 'practice areas',
  step4: 'verification documents',
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin Privileges Required.' }, { status: 401 });
    }

    const application = await prisma.lawyerApplication.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!application || application.status !== 'SUBMITTED') {
      return NextResponse.json({ error: 'Valid SUBMITTED application not found.' }, { status: 400 });
    }

    // Parsed, not cast. Nothing below invents a value.
    const parsed = fullApplicationSchema.safeParse(application.draftData);
    if (!parsed.success) {
      // Named the way the application form names its steps, for the admin.
      const missing = [...new Set(parsed.error.issues.map((i) => STEP_NAMES[String(i.path[0])] ?? 'other details'))];
      return NextResponse.json(
        {
          error:
            `This application is incomplete (${missing.join(', ')}) and cannot be approved. ` +
            'Reject it with a note asking the applicant to complete it.',
          details: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const { step1, step2, step3, step4 } = parsed.data;

    // A BASL number identifies one admitted attorney. If it is already on the
    // system, either this is a duplicate application or somebody has entered
    // someone else's number — both need a human, not a 500 from a unique
    // constraint halfway through the transaction.
    const existingBasl = await prisma.lawyerProfile.findUnique({
      where: { baslNumber: step2.baslNumber },
      select: { id: true, fullName: true },
    });

    if (existingBasl) {
      return NextResponse.json(
        {
          error: `BASL number ${step2.baslNumber} is already registered to ${existingBasl.fullName}. Check the number before approving.`,
        },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Record the decision, and reduce the draft.
      //
      // Everything the draft held is about to be written to the profile, so
      // keeping a second copy of an applicant's identity documents and NIC
      // serves no purpose and doubles the exposure. A REJECTED application keeps
      // its data (the decision has to be explainable); an approved one does not.
      await tx.lawyerApplication.update({
        where: { id },
        data: { status: 'APPROVED', draftData: APPROVED_DRAFT_STUB },
      });

      // 2. The permanent LawyerProfile.
      const profile = await tx.lawyerProfile.create({
        data: {
          userId: application.userId,
          fullName: step1.fullName,
          baslNumber: step2.baslNumber,
          gender: step1.gender || null,
          bio: step1.bio || null,
          address: step1.address,
          latitude: step1.latitude ? parseFloat(step1.latitude) : null,
          longitude: step1.longitude ? parseFloat(step1.longitude) : null,
          contactPhone: step1.phone,
          isVerified: true,
          practiceAreas: step3.practiceAreas,
          languages: step1.languages,
          district: step1.district,
          yearsOfExperience: parseInt(step2.yearsOfExperience, 10),
          practiceType: step2.practiceType,
          courts: [step2.courts],
          isNotary: step2.isNotary,
          licenseImageUrl: step4.licenseImage,
          identityImageUrl: step4.identityImage,
        },
      });

      // 3. No practice is created. Until 2026-10-13 a firm of one was made here
      // silently; now an approved attorney has none — is not listed and cannot be
      // engaged — until they register their practice (as a sole practitioner or
      // a firm) or accept an invitation into one. See src/lib/firms/provisioning.ts.

      // 4. Elevate the account role.
      await tx.user.update({
        where: { id: application.userId },
        data: { role: 'LAWYER' },
      });
    });

    // Not awaited: the mail server takes 5-18 s and the admin should not wait
    // on it. server.js is long-lived, so the send completes after the response;
    // sendMailSafe logs a failure and never throws.
    void EmailService.sendApplicationApproved(application.user.email, step1.fullName);

    return NextResponse.json(
      {
        success: true,
        // No practice is created on approval (see step 3 above).
        message: 'Attorney verified. They are not listed until they register a practice or join one.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Critical failure during approval transaction.' }, { status: 500 });
  }
}
