import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST: Submit a review (must be logged in)
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'You must be logged in to submit a review.' }, { status: 401 });
    }

    const body = await req.json();
    const { lawyerId, rating, comment } = body;

    if (!lawyerId || !rating || !comment) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5.' }, { status: 400 });
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
        reviewerName: user.fullName || user.email.split('@')[0],
        rating: parseInt(String(rating)),
        comment,
        isApproved: false, // needs admin approval
      },
    });

    return NextResponse.json({ success: true, review }, { status: 201 });
  } catch (error) {
    console.error('[REVIEW_POST_ERROR]', error);
    return NextResponse.json({ error: 'Failed to submit review.' }, { status: 500 });
  }
}

// GET: Get reviews for a specific lawyer
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lawyerId = searchParams.get('lawyerId');

    if (!lawyerId) {
      return NextResponse.json({ error: 'lawyerId is required.' }, { status: 400 });
    }

    const reviews = await prisma.review.findMany({
      where: { lawyerId, isApproved: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(reviews, { status: 200 });
  } catch (error) {
    console.error('[REVIEW_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch reviews.' }, { status: 500 });
  }
}
