import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ApplicationDraftSchema, stepSchemas } from '@/schemas/application.schema';

/**
 * Saving a draft attorney application.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The bug this route used to have, because it is worth not reintroducing.
 *
 * It validated only the steps BEFORE the current one (`for s = 1; s < currentStep`)
 * and then wrote `body.draftData` — the RAW REQUEST BODY — to the database. So
 * the step the applicant was actually on was never checked, and any key a caller
 * invented was persisted verbatim into an untyped `Json` column forever. That is
 * how `draftData` became the "unaudited Json blob" of DATA-INVENTORY.md §7
 * finding D, holding among other things two multi-megabyte base64 images.
 *
 * The fix is one sentence: parse the whole thing with a strict schema and store
 * the PARSED OUTPUT. Validating and then saving something else is the shape of
 * the mistake, not the missing rule.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    // Only current CLIENTs are allowed to draft applications.
    if (!session || session.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized to draft profile' }, { status: 401 });
    }

    const body = await req.json();
    const { currentStep } = body;

    if (!currentStep || typeof currentStep !== 'number' || currentStep < 1 || currentStep > 4) {
      return NextResponse.json({ error: 'Invalid step number.' }, { status: 400 });
    }

    // Strict parse of the whole draft. Rejects unknown keys rather than storing
    // them, and — unlike the old loop — covers the step currently being edited.
    const draft = ApplicationDraftSchema.safeParse(body.draftData);
    if (!draft.success) {
      const first = draft.error.issues[0];
      return NextResponse.json(
        {
          error: first
            ? `${first.path.join('.')}: ${first.message}`
            : 'That draft could not be saved.',
          details: draft.error.issues,
        },
        { status: 400 }
      );
    }

    // Steps the applicant has already moved past must be COMPLETE, not merely
    // well-formed. The draft schema makes every field optional (a draft is
    // incomplete by definition); this is where "you have finished step 2" is
    // actually checked.
    for (let s = 1; s < currentStep; s++) {
      const schema = stepSchemas[s as keyof typeof stepSchemas];
      const stepKey = `step${s}` as keyof typeof draft.data;
      const result = schema.safeParse(draft.data[stepKey]);
      if (!result.success) {
        const firstError = result.error.issues[0]?.message || 'Validation failed.';
        return NextResponse.json(
          { error: `Step ${s}: ${firstError}`, details: result.error.issues },
          { status: 400 }
        );
      }
    }

    const application = await prisma.lawyerApplication.upsert({
      where: { userId: session.userId },
      update: {
        currentStep,
        // The PARSED value, not `body.draftData`.
        draftData: draft.data,
        status: 'DRAFT',
      },
      create: {
        userId: session.userId,
        currentStep,
        draftData: draft.data,
        status: 'DRAFT',
      },
    });

    return NextResponse.json({ success: true, applicationId: application.id }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to securely save draft data' }, { status: 500 });
  }
}
