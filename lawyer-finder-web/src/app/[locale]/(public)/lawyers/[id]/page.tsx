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
      user: { select: { createdAt: true } },
      reviews: { where: { isApproved: true }, orderBy: { id: 'desc' } },
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
    user: lawyer.user ? { createdAt: lawyer.user.createdAt.toISOString() } : null,
    reviews: lawyer.reviews.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
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
