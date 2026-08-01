import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';

    const applications = await prisma.lawyerApplication.findMany({
      where: { 
        status: 'SUBMITTED',
      },
      orderBy: { submittedAt: 'desc' },
      include: { user: { select: { email: true, createdAt: true } } },
    });

    // Map and filter by search
    const mapped = applications.map(app => {
      const data = app.draftData as any;
      return {
        id: app.id,
        userId: app.userId,
        fullName: data?.step1?.fullName || 'No Name',
        gender: data?.step1?.gender || 'N/A',
        phone: data?.step1?.phone || 'N/A',
        address: data?.step1?.address || 'N/A',
        district: data?.step1?.district || 'N/A',
        languages: Array.isArray(data?.step1?.languages) ? data.step1.languages.join(', ') : (data?.step1?.languages || 'N/A'),
        bio: data?.step1?.bio || '',
        baslNumber: data?.step2?.baslNumber || 'MISSING',
        yearsOfExperience: data?.step2?.yearsOfExperience || 'N/A',
        practiceType: data?.step2?.practiceType || 'N/A',
        courts: Array.isArray(data?.step2?.courts) ? data.step2.courts.join(', ') : (data?.step2?.courts || 'N/A'),
        isNotary: data?.step2?.isNotary || false,
        practiceAreas: Array.isArray(data?.step3?.practiceAreas) ? data.step3.practiceAreas.join(', ') : (data?.step3?.practiceAreas || 'N/A'),
        licenseImage: data?.step4?.licenseImage || null,
        identityImage: data?.step4?.identityImage || null,
        email: app.user.email,
        submittedAt: app.submittedAt,
        userCreatedAt: app.user.createdAt,
        status: app.status,
        draftData: data,
      };
    });

    const filtered = search
      ? mapped.filter(a => a.fullName.toLowerCase().includes(search.toLowerCase()))
      : mapped;

    return NextResponse.json({ applications: filtered }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
