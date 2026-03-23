import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { inquirySchema } from '@/schemas/inquiry.schema';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = inquirySchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    // Verify that the lawyer exists
    const lawyer = await prisma.lawyerProfile.findUnique({
      where: { id: validated.data.lawyerId },
    });

    if (!lawyer) {
      return NextResponse.json({ error: 'Lawyer not found.' }, { status: 404 });
    }

    const inquiry = await prisma.inquiry.create({
      data: validated.data,
    });

    return NextResponse.json({ success: true, inquiryId: inquiry.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
