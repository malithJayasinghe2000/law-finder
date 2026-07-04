import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { z } from 'zod';
import { sanitizeString, isValidUUID } from '@/lib/security';

// ── Review Schema ─────────────────────────────────────────────────────────
const createReviewSchema = z.object({
  lawyerId: z.string().uuid('Invalid lawyer reference.'),
  rating: z.coerce.number().int('Rating must be a whole number.').min(1, 'Rating must be at least 1.').max(5, 'Rating cannot exceed 5.'),
  comment: z.string().min(5, 'Review must be at least 5 characters.').max(2000, 'Review cannot exceed 2000 characters.'),
});

// POST: Submit a review (must be logged in)
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'You must be logged in to submit a review.' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid review data.' }, { status: 400 });
    }

    const { lawyerId, rating, comment } = parsed.data;
    const sanitizedComment = sanitizeString(comment, 2000);

    if (!sanitizedComment || sanitizedComment.length < 5) {
      return NextResponse.json({ error: 'Review comment must contain at least 5 valid characters.' }, { status: 400 });
    }

    // Get user's display name
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { fullName: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Check if lawyer exists
    const lawyer = await prisma.lawyerProfile.findUnique({ where: { id: lawyerId } });
    if (!lawyer) {
      return NextResponse.json({ error: 'Lawyer not found.' }, { status: 404 });
    }

    // Prevent reviewing yourself
    if (lawyer.userId === session.userId) {
      return NextResponse.json({ error: 'You cannot review yourself.' }, { status: 400 });
    }

    const review = await prisma.review.create({
      data: {
        lawyerId,
        reviewerId: session.userId,
        reviewerName: sanitizeString(user.fullName || user.email.split('@')[0], 120),
        rating,
        comment: sanitizedComment,
        isApproved: false, // needs admin approval
      },
    });

    return NextResponse.json({ success: true, reviewId: review.id }, { status: 201 });
  } catch (error) {
    console.error('[REVIEW_POST_ERROR]', error instanceof Error ? error.message : 'Review submission failed');
    return NextResponse.json({ error: 'Failed to submit review.' }, { status: 500 });
  }
}

// GET: Get reviews for a specific lawyer
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lawyerId = searchParams.get('lawyerId');

    if (!lawyerId || !isValidUUID(lawyerId)) {
      return NextResponse.json({ error: 'A valid lawyerId is required.' }, { status: 400 });
    }

    const reviews = await prisma.review.findMany({
      where: { lawyerId, isApproved: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(reviews, { status: 200 });
  } catch (error) {
    console.error('[REVIEW_GET_ERROR]', error instanceof Error ? error.message : 'Review fetch failed');
    return NextResponse.json({ error: 'Failed to fetch reviews.' }, { status: 500 });
  }
}

