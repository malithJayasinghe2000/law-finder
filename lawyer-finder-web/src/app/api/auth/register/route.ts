import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { registerSchema } from '@/schemas/auth.schema';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = registerSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const { email, password, fullName, role, baslNumber } = validated.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Only create LawyerProfile for LAWYER role
    if (role === 'LAWYER') {
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: 'LAWYER',
          profile: {
            create: {
              fullName,
              baslNumber: baslNumber!,
              isVerified: false,
            },
          },
        },
      });
    } else {
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: 'CLIENT',
        },
      });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('[REGISTER_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
