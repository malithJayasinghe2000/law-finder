import type { Prisma, PrismaClient } from '@prisma/client';

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Creating the practice an attorney works through.
 *
 * Until 2026-10-13 a "firm of one" was created silently the moment an
 * attorney's application was approved. It no longer is: an approved attorney
 * has no practice — and is not listed and cannot be engaged — until they
 * REGISTER one (as a sole practitioner or a firm, through
 * /api/firms/register) or accept an invitation into one. A practice exists
 * because a principal deliberately registered it and an administrator checked
 * it, never as a side effect. See docs/restructure/PROGRESS.md (2026-10-13).
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 7) and PHASE-2-BRIEF.md §4.
 */

/** Turn a firm or attorney name into a URL-safe slug fragment. */
export function slugifyFirmName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'firm'
  );
}

/**
 * Find a slug nobody is using.
 *
 * Two attorneys can share a name — the backfill migration had to handle exactly
 * that — so never assume the base slug is free.
 */
export async function allocateFirmSlug(tx: Tx, name: string): Promise<string> {
  const base = slugifyFirmName(name);

  const taken = await tx.lawFirm.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });

  if (!taken.some((f) => f.slug === base)) return base;

  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.some((f) => f.slug === candidate)) return candidate;
  }

  // Astronomically unlikely; still better than returning a duplicate.
  return `${base}-${Date.now().toString(36)}`;
}

export type SoloFirmSeed = {
  userId: string;
  profileId: string;
  fullName: string;
  baslNumber: string;
  bio?: string | null;
  practiceAreas?: string[];
  languages?: string[];
  courts?: string[];
  district?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  profileImageUrl?: string | null;
  isVerified?: boolean;
};

/**
 * Create a firm of one for a newly approved attorney and make them its owner.
 *
 * Must be called inside the same transaction that creates the LawyerProfile, so
 * an attorney can never exist without a firm.
 */
export async function createSoloFirmForAttorney(
  tx: Tx,
  seed: SoloFirmSeed
): Promise<{ firmId: string; slug: string }> {
  const slug = await allocateFirmSlug(tx, seed.fullName);

  const firm = await tx.lawFirm.create({
    data: {
      slug,
      name: seed.fullName,
      firmType: 'SOLE_PRACTITIONER',
      isSoloPractice: true,
      principalBaslNumber: seed.baslNumber,
      description: seed.bio ?? null,
      practiceAreas: seed.practiceAreas ?? [],
      languages: seed.languages ?? [],
      courts: seed.courts ?? [],
      district: seed.district ?? null,
      contactPhone: seed.contactPhone ?? null,
      contactEmail: seed.contactEmail ?? null,
      logoUrl: seed.profileImageUrl ?? null,
      // A firm of one is verified to exactly the extent its only member is. A
      // firm with employees has to be verified in its own right.
      verificationStatus: seed.isVerified ? 'VERIFIED' : 'UNVERIFIED',
      verifiedAt: seed.isVerified ? new Date() : null,
      members: {
        create: {
          userId: seed.userId,
          role: 'FIRM_OWNER',
          status: 'ACTIVE',
          title: 'Principal',
        },
      },
      ...(seed.address
        ? {
            offices: {
              create: {
                label: 'Main office',
                address: seed.address,
                district: seed.district ?? null,
                contactPhone: seed.contactPhone ?? null,
                isPrimary: true,
              },
            },
          }
        : {}),
    },
    select: { id: true, slug: true },
  });

  await tx.lawyerProfile.update({
    where: { id: seed.profileId },
    data: { firmId: firm.id },
  });

  return { firmId: firm.id, slug: firm.slug };
}

/** The practice an attorney belongs to, or null. Never creates one. */
export async function findAttorneyFirmId(tx: Tx, profileId: string): Promise<string | null> {
  const profile = await tx.lawyerProfile.findUnique({
    where: { id: profileId },
    select: { firmId: true },
  });
  return profile?.firmId ?? null;
}

/**
 * Create the practice for an attorney who is registering one and has none.
 *
 * Called ONLY from firm registration — the attorney's deliberate act. Returns
 * the existing firm id when there already is one (an attorney approved before
 * 2026-10-13 still has the firm of one created for them then).
 */
export async function createPracticeForAttorney(
  tx: Tx,
  profileId: string
): Promise<string | null> {
  const profile = await tx.lawyerProfile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      firmId: true,
      userId: true,
      fullName: true,
      baslNumber: true,
      bio: true,
      practiceAreas: true,
      languages: true,
      courts: true,
      district: true,
      contactPhone: true,
      address: true,
      profileImageUrl: true,
      isVerified: true,
      user: { select: { email: true } },
    },
  });

  if (!profile) return null;
  if (profile.firmId) return profile.firmId;

  const { firmId } = await createSoloFirmForAttorney(tx, {
    userId: profile.userId,
    profileId: profile.id,
    fullName: profile.fullName,
    baslNumber: profile.baslNumber,
    bio: profile.bio,
    practiceAreas: profile.practiceAreas,
    languages: profile.languages,
    courts: profile.courts,
    district: profile.district,
    contactPhone: profile.contactPhone,
    contactEmail: profile.user?.email ?? null,
    address: profile.address,
    profileImageUrl: profile.profileImageUrl,
    isVerified: profile.isVerified,
  });

  return firmId;
}
