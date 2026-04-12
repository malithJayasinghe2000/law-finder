import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck, MapPin, Languages, Star, Briefcase, Clock, Phone,
  Globe, Calendar, Scale, Gavel, BookOpen, ArrowRight,
} from 'lucide-react';
import LawyerProfileClient from './LawyerProfileClient';

export default async function LawyerProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await getSession();

  const lawyer = await prisma.lawyerProfile.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, createdAt: true } },
      reviews: { 
        where: { isApproved: true }, 
        orderBy: { id: 'desc' },
        include: { reviewer: true }
      },
      Subscription: {
        where: { status: 'ACTIVE' },
        include: { plan: true, role: true },
        take: 1,
      },
    },
  });

  if (!lawyer) notFound();

  const avgRating =
    lawyer.reviews.length > 0
      ? lawyer.reviews.reduce((sum, r) => sum + r.rating, 0) / lawyer.reviews.length
      : 0;

  // Fetch other lawyers for the "Other Lawyers" marquee
  const otherLawyers = await prisma.lawyerProfile.findMany({
    where: { isVerified: true, id: { not: lawyer.id } },
    include: { reviews: { where: { isApproved: true } } },
    take: 12,
    orderBy: { fullName: 'asc' },
  });

  const serializedLawyer = {
    ...lawyer,
    user: lawyer.user ? { id: lawyer.user.id, createdAt: lawyer.user.createdAt.toISOString() } : null,
    reviews: lawyer.reviews.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      reviewerImage: r.reviewer?.profileImageUrl || null,
    })),
    subscription: lawyer.Subscription[0] ? {
      id: lawyer.Subscription[0].id,
      tier: lawyer.Subscription[0].plan.tier,
      planName: lawyer.Subscription[0].plan.name,
      status: lawyer.Subscription[0].status,
      billingCycle: lawyer.Subscription[0].billingCycle,
      startDate: lawyer.Subscription[0].startDate.toISOString(),
      nextBilling: lawyer.Subscription[0].nextBilling.toISOString(),
    } : null,
  };

  const serializedOtherLawyers = otherLawyers.map(l => {
    const avg = l.reviews.length > 0
      ? l.reviews.reduce((sum, r) => sum + r.rating, 0) / l.reviews.length
      : 0;
    return {
      id: l.id,
      fullName: l.fullName,
      profileImageUrl: l.profileImageUrl,
      bio: l.bio,
      practiceAreas: l.practiceAreas,
      district: l.district,
      baseFeeRange: l.baseFeeRange,
      avgRating: Math.round(avg * 10) / 10,
      reviewCount: l.reviews.length,
      languages: l.languages,
    };
  });

  return (
    <LawyerProfileClient
      lawyer={serializedLawyer}
      avgRating={Math.round(avgRating * 10) / 10}
      otherLawyers={serializedOtherLawyers}
      locale={locale}
      isLoggedIn={!!session}
      currentUserId={session?.userId || null}
    />
  );
}
