import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

// GET: Check current session status (used to restrict auth pages for logged-in users)
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { 
        fullName: true, 
        profileImageUrl: true, 
        email: true,
        role: true,
      },
    });

    return NextResponse.json({
      authenticated: true,
      role: session.role,
      userId: session.userId,
      fullName: user?.fullName,
      profileImageUrl: user?.profileImageUrl,
      email: user?.email,
    }, { status: 200 });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}
