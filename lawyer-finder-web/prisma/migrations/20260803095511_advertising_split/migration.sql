-- ─────────────────────────────────────────────────────────────────────────────
-- The advertising split.
--
-- Until now, advertising on this platform was sold to attorneys. An attorney
-- bought an AdCampaign and appeared as a promoted card — including, until Phase
-- 2, at the top of the attorney directory itself, and until this migration,
-- beside the AI chat where a person describes their legal problem.
--
-- That is selling visibility to a lawyer: prohibited by guardrail rule 3 and by
-- Supreme Court Rules 39-49, and — because touting reaches the intermediary —
-- criminal exposure for this platform's operators under the Intermeddlers with
-- Suitors Ordinance No. 11 of 1894.
--
-- After this migration advertising is sold to NON-LEGAL advertisers only, and
-- the rule is structural rather than procedural: AdCampaign belongs to an
-- Advertiser and has no relation to LawyerProfile or LawFirm at all. A lawyer
-- cannot buy an advert because there is nowhere in the schema to put them.
--
-- See docs/restructure/LEGAL-GUARDRAILS.md (rule 3).
-- ─────────────────────────────────────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "AdvertiserCategory" AS ENUM ('BANKING_FINANCE', 'INSURANCE', 'EDUCATION', 'PUBLISHING_MEDIA', 'TECHNOLOGY', 'HEALTHCARE', 'REAL_ESTATE', 'GOVERNMENT_NGO', 'RETAIL_CONSUMER', 'PROFESSIONAL_SERVICES', 'OTHER');

-- CreateEnum
CREATE TYPE "AdvertiserStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- ─── Clear the attorney-owned advertising that is being abolished ────────────
--
-- Every existing campaign belongs to an attorney. There is no advertiser to
-- migrate them to, and migrating them would be migrating the violation. They
-- are deleted, along with their slot reservations and analytics.
--
-- Deliberately destructive, and correct: this data is the thing the migration
-- exists to remove.
DELETE FROM "AdAnalytics";
DELETE FROM "AdSlotBooking";
DELETE FROM "AdCampaign";

-- The directory placements go before the enum can be rewritten. Selling a
-- position inside a list of attorneys is wrong whoever buys it: it teaches a
-- client that position in that list is purchasable, and blurs an advertisement
-- into a listing.
DELETE FROM "AdPlacementConfig" WHERE "placement"::text IN ('DIRECTORY_TOP', 'DIRECTORY_INLINE');

-- AlterEnum: DIRECTORY_TOP and DIRECTORY_INLINE are removed from the type
-- entirely, so restoring them needs a migration and a conversation rather than
-- a toggle in an admin screen. LEGAL_LIBRARY_SIDEBAR is added — an editorial
-- surface, which is where advertising belongs.
BEGIN;
CREATE TYPE "AdPlacement_new" AS ENUM ('HOMEPAGE_BELOW_HERO', 'CHAT_RIGHT_SIDEBAR', 'BLOG_TOP_BANNER', 'BLOG_RIGHT_SIDEBAR', 'BLOG_BOTTOM_STICKY', 'BLOG_POST_SIDEBAR', 'BLOG_POST_BOTTOM', 'LEGAL_LIBRARY_SIDEBAR');
ALTER TABLE "AdPlacementConfig" ALTER COLUMN "placement" TYPE "AdPlacement_new" USING ("placement"::text::"AdPlacement_new");
ALTER TABLE "AdCampaign" ALTER COLUMN "placement" TYPE "AdPlacement_new" USING ("placement"::text::"AdPlacement_new");
ALTER TABLE "AdSlotBooking" ALTER COLUMN "placement" TYPE "AdPlacement_new" USING ("placement"::text::"AdPlacement_new");
ALTER TYPE "AdPlacement" RENAME TO "AdPlacement_old";
ALTER TYPE "AdPlacement_new" RENAME TO "AdPlacement";
DROP TYPE "public"."AdPlacement_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "AdCampaign" DROP CONSTRAINT "AdCampaign_lawyerId_fkey";

-- DropForeignKey
ALTER TABLE "PaidPromo" DROP CONSTRAINT "PaidPromo_lawyerId_fkey";

-- AlterTable: the campaign now belongs to an advertiser. Safe as NOT NULL
-- without a default because every row was deleted above.
ALTER TABLE "AdCampaign" DROP COLUMN "lawyerId",
ADD COLUMN     "advertiserId" TEXT NOT NULL,
ALTER COLUMN "ctaText" SET DEFAULT 'Learn more';

-- DropTable: PaidPromo sold a promotional slot to an attorney. It is not
-- repurposed or renamed — it is deleted.
DROP TABLE "PaidPromo";

-- DropEnum
DROP TYPE "PromoStatus";

-- CreateTable
CREATE TABLE "Advertiser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "registrationNumber" TEXT,
    "category" "AdvertiserCategory" NOT NULL,
    "status" "AdvertiserStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "contactName" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "websiteUrl" TEXT,
    "logoUrl" TEXT,
    "nonLegalConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "nonLegalConfirmedAt" TIMESTAMP(3),
    "nonLegalConfirmedById" TEXT,
    "reviewNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advertiser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Advertiser_status_idx" ON "Advertiser"("status");

-- CreateIndex
CREATE INDEX "Advertiser_category_idx" ON "Advertiser"("category");

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The new editorial placement needs a config row so it can be administered.
INSERT INTO "AdPlacementConfig" (
  "id", "placement", "displayName", "description", "pricePerDay",
  "isActive", "allowedAdTypes", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'LEGAL_LIBRARY_SIDEBAR',
  'Legal library sidebar',
  'Right-hand sidebar of the legal library. Editorial surface — non-legal advertisers only.',
  2500,
  false,
  ARRAY[]::"AdType"[],
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "AdPlacementConfig" WHERE "placement" = 'LEGAL_LIBRARY_SIDEBAR'
);
