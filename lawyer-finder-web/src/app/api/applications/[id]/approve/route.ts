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
          gender: data.step1?.gender || null,
          bio: data.step1?.bio || null,
          address: data.step1?.address || null,
          latitude: data.step1?.latitude && data.step1.latitude !== '' ? parseFloat(data.step1.latitude) : null,
          longitude: data.step1?.longitude && data.step1.longitude !== '' ? parseFloat(data.step1.longitude) : null,
          contactPhone: data.step1?.phone || null,
          isVerified: true,
          practiceAreas: Array.isArray(data.step3?.practiceAreas) 
            ? data.step3.practiceAreas 
            : (typeof data.step3?.practiceAreas === 'string' && data.step3.practiceAreas.trim() 
              ? data.step3.practiceAreas.split(',').map((s: string) => s.trim()) 
              : []),
          languages: Array.isArray(data.step1?.languages) 
            ? data.step1.languages 
            : (typeof data.step1?.languages === 'string' && data.step1.languages.trim() 
              ? data.step1.languages.split(',').map((s: string) => s.trim()) 
              : []),
          district: data.step1?.district || null,
          baseFeeRange: data.step3?.baseFeeRange || null,
          yearsOfExperience: data.step2?.yearsOfExperience ? parseInt(data.step2.yearsOfExperience, 10) : null,
          practiceType: data.step2?.practiceType || null,
          courts: Array.isArray(data.step2?.courts) 
            ? data.step2.courts 
            : (typeof data.step2?.courts === 'string' && data.step2.courts.trim() 
              ? data.step2.courts.split(',').map((s: string) => s.trim()) 
              : []),
          isNotary: Boolean(data.step2?.isNotary),
          licenseImageUrl: data.step4?.licenseImage || null,
          identityImageUrl: data.step4?.identityImage || null,
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
