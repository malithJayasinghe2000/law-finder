import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { issueVerificationLink } from '@/lib/emailVerification';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (user.isEmailVerified) {
      return NextResponse.json({ error: 'Email is already verified' }, { status: 400 });
    }

    const lastToken = await prisma.verificationToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    if (lastToken) {
      const timeSinceLastToken = Date.now() - lastToken.createdAt.getTime();
      if (timeSinceLastToken < 60000) {
        return NextResponse.json({ error: 'Please wait a minute before requesting another email.' }, { status: 429 });
      }
    }

    // Delete existing tokens for this user
    await prisma.verificationToken.deleteMany({ where: { userId: user.id } });

    await issueVerificationLink(user, { redirect: body?.redirect, locale: body?.locale });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
