import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    // Only current CLIENTs are allowed to draft applications.
    if (!session || session.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized to draft profile' }, { status: 401 });
    }

    const body = await req.json();
    const { currentStep, draftData } = body;

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
