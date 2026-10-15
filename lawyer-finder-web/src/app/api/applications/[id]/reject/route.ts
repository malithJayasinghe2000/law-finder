import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { EmailService } from '@/lib/email/EmailService';
import { RejectApplicationSchema } from '@/schemas/application.schema';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const parsed = RejectApplicationSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'A reason is required.' }, { status: 400 });
    }
    const { reason } = parsed.data;

    // Only a submitted application can be rejected. This used to update any
    // application by id: an approved one became REJECTED and the attorney was
    // emailed a rejection while their profile stayed verified.
    const { count } = await prisma.lawyerApplication.updateMany({
      where: { id, status: 'SUBMITTED' },
      data: {
        status: 'REJECTED',
        adminNotes: reason
      },
    });
    if (count === 0) {
      return NextResponse.json({ error: 'Only a submitted application can be rejected.' }, { status: 409 });
    }

    const application = await prisma.lawyerApplication.findUniqueOrThrow({
      where: { id },
      include: { user: true }
    });

    const data = application.draftData as any;
    const name = data.step1?.fullName || 'Applicant';

    // Not awaited: the mail server takes 5-18 s and the admin should not wait
    // on it. server.js is long-lived, so the send completes after the response;
    // sendMailSafe logs a failure and never throws.
    void EmailService.sendApplicationRejected(application.user.email, name, reason);

    return NextResponse.json({ success: true, message: 'Application rejected. The applicant will be emailed the reason.' }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to execute rejection.' }, { status: 500 });
  }
}
