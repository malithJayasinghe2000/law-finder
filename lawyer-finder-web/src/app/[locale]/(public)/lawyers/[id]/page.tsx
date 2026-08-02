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

  // Every field selected here is serialized into the RSC payload and is readable
  // in page source whether or not the UI renders it. That makes this query, not
  // the JSX, the real boundary of what we publish about an attorney.
  //
  // Deliberately NOT loaded:
  //   consultationPricing — fees are quoted per matter, never advertised (rule 1)
  //   baseFeeRange        — a fee indication, beyond the Rule 40 content limit
  //   reviews             — star ratings on a directory are unfair attraction
  //                         under Rule 39 and would make ordering non-neutral
  //   Subscription        — what an attorney pays us must never be visible to a
  //                         client, in the payload or as a badge (rules 3 and 4)
  //
  // See docs/restructure/LEGAL-GUARDRAILS.md — "The Rule 40 content limit".
  const lawyer = await prisma.lawyerProfile.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      baslNumber: true,
      address: true,
      contactPhone: true,
      profileImageUrl: true,
      bio: true,
      practiceAreas: true,
      languages: true,
      district: true,
      gender: true,
      yearsOfExperience: true,
      practiceType: true,
      courts: true,
      isNotary: true,
      isVerified: true,
      user: { select: { id: true, createdAt: true } },
    },
  });

  if (!lawyer) notFound();

  // Other verified attorneys, alphabetically. Not "similar", not "recommended" —
  // just the rest of the directory, ordered on a criterion nobody can buy.
  const otherLawyers = await prisma.lawyerProfile.findMany({
    where: { isVerified: true, id: { not: lawyer.id } },
    select: {
      id: true,
      fullName: true,
      profileImageUrl: true,
      bio: true,
      practiceAreas: true,
      district: true,
      languages: true,
    },
    take: 12,
    orderBy: { fullName: 'asc' },
  });

  const serializedLawyer = {
    ...lawyer,
    user: lawyer.user ? { id: lawyer.user.id, createdAt: lawyer.user.createdAt.toISOString() } : null,
  };

  return (
    <LawyerProfileClient
      lawyer={serializedLawyer}
      otherLawyers={otherLawyers}
      locale={locale}
      isLoggedIn={!!session}
      currentUserId={session?.userId || null}
    />
  );
}
