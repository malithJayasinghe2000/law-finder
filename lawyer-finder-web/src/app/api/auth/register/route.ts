import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { registerSchema } from '@/schemas/auth.schema';
import crypto from 'crypto';
import { EmailService } from '@/lib/email/EmailService';
import { checkRateLimit, getClientIp, sanitizeString } from '@/lib/security';

export async function POST(req: Request) {
  try {
    // Rate limiting: max 3 registrations per hour per IP
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(`register:${clientIp}`, 3, 60 * 60 * 1000);
    if (!rateCheck.allowed) {
      const retryAfterSec = Math.ceil(rateCheck.retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Too many registration attempts. Please try again in ${Math.ceil(retryAfterSec / 60)} minutes.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validated = registerSchema.safeParse(body);
    
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const { email, password } = validated.data;
    const normalizedEmail = email.toLowerCase().trim();
    const sanitizedName = sanitizeString(validated.data.fullName, 120);

    if (!sanitizedName || sanitizedName.length < 3) {
      return NextResponse.json({ error: 'Full name must be at least 3 valid characters.' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12); // Increased salt rounds from 10 to 12

    // Creates ONLY a User row. A LawyerProfile is not constructed until
    // a LawyerApplication is approved by an Admin.
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName: sanitizedName,
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

    // Don't expose userId in response — information leakage
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('[AUTH_REGISTER]', error instanceof Error ? error.message : 'Registration failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

