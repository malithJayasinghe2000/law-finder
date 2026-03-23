import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { EmailService } from '@/lib/email/EmailService';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json();
    const { reason } = body;

    const application = await prisma.lawyerApplication.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminNotes: reason
      },
      include: { user: true }
    });

    const data = application.draftData as any;
    const name = data.step1?.fullName || 'Applicant';

    await EmailService.sendApplicationRejected(application.user.email, name, reason);

    return NextResponse.json({ success: true, message: 'Application safely rejected.' }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to execute rejection.' }, { status: 500 });
  }
}
