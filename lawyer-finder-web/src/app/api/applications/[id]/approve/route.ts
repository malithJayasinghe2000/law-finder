import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { EmailService } from '@/lib/email/EmailService';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    
    // Only Master Admins can execute role elevations.
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin Privileges Required.' }, { status: 401 });
    }

    const application = await prisma.lawyerApplication.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!application || application.status !== 'SUBMITTED') {
      return NextResponse.json({ error: 'Valid SUBMITTED application not found.' }, { status: 400 });
    }

    const data = application.draftData as any;

    // We use a Prisma Transaction to ensure ALL these database writes succeed, or rollback if ANY fail.
    await prisma.$transaction(async (tx) => {
      // 1. Permanently update the Application state to APPROVED
      await tx.lawyerApplication.update({
        where: { id },
        data: { status: 'APPROVED' }
      });

      // 2. Parse the temporary JSON payload and forge the permanent LawyerProfile record.
      await tx.lawyerProfile.create({
        data: {
          userId: application.userId,
          fullName: data.step1?.fullName || 'Verified Lawyer',
          baslNumber: data.step2?.baslNumber || `BASL-MANUAL-${Date.now()}`,
          nic: data.step1?.nic || null,
          address: data.step1?.address || null,
          contactPhone: data.step1?.phone || null,
          isVerified: true,
          practiceAreas: data.step3?.practiceAreas || [],
          languages: data.step3?.languages || [],
          district: data.step3?.district || null,
        }
      });

      // 3. Command the elevation of the physical User account Role Enum
      await tx.user.update({
        where: { id: application.userId },
        data: { role: 'LAWYER' }
      });
    });

    // 4. Trigger global notification asynchronously
    await EmailService.sendApplicationApproved(application.user.email, data.step1?.fullName || 'Lawyer');

    return NextResponse.json({ success: true, message: 'Lawyer verified & authorized globally.' }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Critical failure during approval transaction.' }, { status: 500 });
  }
}
