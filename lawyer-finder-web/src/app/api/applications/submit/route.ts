import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fullApplicationSchema } from '@/schemas/application.schema';

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

    // A submitted application must be COMPLETE.
    //
    // Nothing checked this before, so an incomplete draft could reach an
    // administrator's approval queue — and the approve route then filled the
    // gaps by inventing values, including a BASL registration number. Refusing
    // here means the reviewer only ever sees applications that could actually
    // become a verified attorney.
    const complete = fullApplicationSchema.safeParse(application.draftData);
    if (!complete.success) {
      const first = complete.error.issues[0];
      return NextResponse.json(
        {
          error: first
            ? `Your application is not complete yet — ${first.path.join('.')}: ${first.message}`
            : 'Your application is not complete yet.',
          details: complete.error.issues,
        },
        { status: 400 }
      );
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
