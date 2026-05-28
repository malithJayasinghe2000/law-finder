import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { registerSchema } from '@/schemas/auth.schema';
import crypto from 'crypto';
import { EmailService } from '@/lib/email/EmailService';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = registerSchema.safeParse(body);
    
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const { email, password } = validated.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Creates ONLY a User row. A LawyerProfile is not constructed until
    // a LawyerApplication is approved by an Admin.
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: validated.data.fullName,
        role: 'CLIENT'
      }
    });

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

    return NextResponse.json({ success: true, userId: user.id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
