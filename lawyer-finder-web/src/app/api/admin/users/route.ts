import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        profile: {
          select: {
            id: true,
            fullName: true,
            isVerified: true,
            district: true,
            baslNumber: true,
          },
          include: {
            Subscription: {
              select: {
                plan: true,
              },
            },
          },
        },
        
        application: {
          select: {
            status: true,
          },
        },
      },
    });

    let filtered = users.map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      fullName: u.profile?.fullName || null,
      isVerified: u.profile?.isVerified || false,
      district: u.profile?.district || null,
      baslNumber: u.profile?.baslNumber || null,
      profileId: u.profile?.id || null,
      applicationStatus: u.application?.status || null,
      isActive: true, // Placeholder — no isActive field in schema yet
    }));

    // Filter by search
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(u =>
        u.email.toLowerCase().includes(s) ||
        (u.fullName && u.fullName.toLowerCase().includes(s))
      );
    }

    // Filter by role
    if (role && role !== 'ALL') {
      filtered = filtered.filter(u => u.role === role);
    }

    // Filter by verification status (for lawyers)
    if (status === 'VERIFIED') {
      filtered = filtered.filter(u => u.isVerified === true);
    } else if (status === 'UNVERIFIED') {
      filtered = filtered.filter(u => u.role === 'LAWYER' && u.isVerified === false);
    }

    return NextResponse.json({ users: filtered }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, action, email, role, password } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    if (action === 'update-details') {
      const updateData: any = {};
      if (email) updateData.email = email;
      if (role) updateData.role = role;

      await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      return NextResponse.json({ message: 'User details updated.' }, { status: 200 });
    }

    if (action === 'update-password') {
      if (!password || password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
      }

      const hash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hash },
      });

      return NextResponse.json({ message: 'Password updated.' }, { status: 200 });
    }

    if (action === 'toggle-verification') {
      const profile = await prisma.lawyerProfile.findFirst({ where: { userId } });
      if (!profile) {
        return NextResponse.json({ error: 'No lawyer profile found.' }, { status: 404 });
      }

      await prisma.lawyerProfile.update({
        where: { id: profile.id },
        data: { isVerified: !profile.isVerified },
      });

      return NextResponse.json({ message: `Verification ${profile.isVerified ? 'revoked' : 'granted'}.` }, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
