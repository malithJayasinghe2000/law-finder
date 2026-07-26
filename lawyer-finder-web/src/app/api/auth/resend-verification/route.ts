import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import crypto from 'crypto';
import { EmailService } from '@/lib/email/EmailService';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

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

    // Generate new token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.verificationToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt
      }
    });

    await EmailService.sendEmailVerification(user.email, token, user.fullName || 'User');

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
