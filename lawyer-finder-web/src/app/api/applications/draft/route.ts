import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  applicationStep1Schema,
  applicationStep2Schema,
  applicationStep3Schema,
  applicationStep4Schema,
} from '@/schemas/application.schema';

const stepSchemas = {
  1: applicationStep1Schema,
  2: applicationStep2Schema,
  3: applicationStep3Schema,
  4: applicationStep4Schema,
} as const;

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    // Only current CLIENTs are allowed to draft applications.
    if (!session || session.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized to draft profile' }, { status: 401 });
    }

    const body = await req.json();
    const { currentStep, draftData } = body;

    if (!currentStep || typeof currentStep !== 'number' || currentStep < 1 || currentStep > 4) {
      return NextResponse.json({ error: 'Invalid step number.' }, { status: 400 });
    }

    if (!draftData || typeof draftData !== 'object') {
      return NextResponse.json({ error: 'Invalid draft data.' }, { status: 400 });
    }

    // Validate all completed steps server-side
    for (let s = 1; s < currentStep; s++) {
      const stepKey = `step${s}` as keyof typeof draftData;
      const schema = stepSchemas[s as keyof typeof stepSchemas];
      const result = schema.safeParse(draftData[stepKey]);
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
        draftData,
        status: 'DRAFT'
      },
      create: {
        userId: session.userId,
        currentStep,
        draftData,
        status: 'DRAFT'
      }
    });

    return NextResponse.json({ success: true, applicationId: application.id }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to securely save draft data' }, { status: 500 });
  }
}
