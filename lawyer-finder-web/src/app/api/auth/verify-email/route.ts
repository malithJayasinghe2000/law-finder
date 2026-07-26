import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/en/login?error=InvalidToken`);
    }

    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!verificationToken) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/en/login?error=InvalidToken`);
    }

    if (verificationToken.expiresAt < new Date()) {
      // Token expired
      await prisma.verificationToken.delete({ where: { id: verificationToken.id } });
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/en/login?error=TokenExpired`);
    }

    // Update user
    await prisma.user.update({
      where: { id: verificationToken.userId },
      data: { isEmailVerified: true }
    });

    // Delete the token
    await prisma.verificationToken.delete({ where: { id: verificationToken.id } });

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/en/login?verified=true`);
  } catch (error) {
    console.error('Verify email error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/en/login?error=ServerError`);
  }
}
