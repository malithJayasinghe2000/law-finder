import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { EmailService } from '@/lib/email/EmailService';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized to submit application' }, { status: 401 });
    }

    const application = await prisma.lawyerApplication.findUnique({
      where: { userId: session.userId },
      include: { user: true }
    });

    if (!application) {
      return NextResponse.json({ error: 'No drafted application found to submit.' }, { status: 400 });
    }

    if (application.status === 'SUBMITTED' || application.status === 'IN_REVIEW') {
      return NextResponse.json({ error: 'Application already submitted.' }, { status: 400 });
    }

    // Lock the application state and move to 'SUBMITTED'
    await prisma.lawyerApplication.update({
      where: { id: application.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date()
      }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to process application submission' }, { status: 500 });
  }
}
