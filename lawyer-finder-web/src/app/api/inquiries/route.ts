import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { z } from 'zod';

const inquirySchema = z.object({
  lawyerId: z.string().uuid(),
  clientName: z.string().min(2, "Name is required"),
  clientPhone: z.string().min(9, "Valid phone number required"),
  clientEmail: z.string().email(),
  message: z.string().min(10, "Message must be descriptive")
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = inquirySchema.safeParse(body);
    
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const inquiry = await prisma.inquiry.create({
      data: validated.data
    });

    // FUTURE: Integrate Resend SDK here to instantly email the lawyer that they received a lead.
    // await resend.emails.send({ to: lawyerEmail, subject: "New Inquiry!", react: EmailTemplate({ inquiry }) });

    return NextResponse.json({ success: true, inquiryId: inquiry.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
