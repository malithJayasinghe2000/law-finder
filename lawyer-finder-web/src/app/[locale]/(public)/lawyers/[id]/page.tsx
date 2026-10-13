import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck, MapPin, Languages, Star, Briefcase, Clock, Phone,
  Globe, Calendar, Scale, Gavel, BookOpen, ArrowRight,
} from 'lucide-react';
import LawyerProfileClient from './LawyerProfileClient';
import { LISTED_ATTORNEY_WHERE } from '@/lib/directory';
import { publishableDescription } from '@/lib/selfPromotion';

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
  // The same rule as the directory: an attorney is shown only through an active,
  // verified firm. A deactivated firm's attorneys are not reachable by old links.
  const lawyer = await prisma.lawyerProfile.findFirst({
    where: { id, ...LISTED_ATTORNEY_WHERE },
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
      yearsOfExperience: true,
      practiceType: true,
      courts: true,
      isNotary: true,
      isVerified: true,
      user: { select: { id: true, createdAt: true } },
      firm: { select: { name: true, slug: true, firmType: true } },
    },
  });

  if (!lawyer) notFound();

  const serializedLawyer = {
    ...lawyer,
    // Filtered here, not only in the JSX: the props are serialized into the page
    // payload, so text withheld on screen would still be published in source.
    bio: publishableDescription(lawyer.bio),
    user: lawyer.user ? { id: lawyer.user.id, createdAt: lawyer.user.createdAt.toISOString() } : null,
  };

  return (
    <LawyerProfileClient
      lawyer={serializedLawyer}
      locale={locale}
      isLoggedIn={!!session}
      currentUserId={session?.userId || null}
    />
  );
}
