-- CreateEnum
CREATE TYPE "FirmType" AS ENUM ('SOLE_PRACTITIONER', 'PARTNERSHIP');

-- CreateEnum
CREATE TYPE "FirmRole" AS ENUM ('FIRM_OWNER', 'FIRM_ADMIN', 'ATTORNEY', 'PARALEGAL');

-- CreateEnum
CREATE TYPE "FirmMemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "FirmVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_lawyerId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_reviewerId_fkey";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedById" TEXT,
ADD COLUMN     "assignmentNote" TEXT,
ADD COLUMN     "firmId" TEXT;

-- AlterTable
ALTER TABLE "LawyerProfile" DROP COLUMN "baseFeeRange",
ADD COLUMN     "firmId" TEXT;

-- DropTable
DROP TABLE "Review";

-- CreateTable
CREATE TABLE "LawFirm" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firmType" "FirmType" NOT NULL DEFAULT 'SOLE_PRACTITIONER',
    "isSoloPractice" BOOLEAN NOT NULL DEFAULT true,
    "registrationNumber" TEXT,
    "principalBaslNumber" TEXT,
    "establishedYear" INTEGER,
    "description" TEXT,
    "practiceAreas" TEXT[],
    "languages" TEXT[],
    "courts" TEXT[],
    "district" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "websiteUrl" TEXT,
    "officeHours" TEXT,
    "logoUrl" TEXT,
    "bankName" TEXT,
    "accountName" TEXT,
    "accountNumber" TEXT,
    "bankBranch" TEXT,
    "verificationStatus" "FirmVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verificationNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LawFirm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmOffice" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "district" TEXT,
    "contactPhone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmOffice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmMember" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "FirmRole" NOT NULL,
    "status" "FirmMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "invitedById" TEXT,
    "invitedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LawFirm_slug_key" ON "LawFirm"("slug");

-- CreateIndex
CREATE INDEX "LawFirm_verificationStatus_idx" ON "LawFirm"("verificationStatus");

-- CreateIndex
CREATE INDEX "LawFirm_district_idx" ON "LawFirm"("district");

-- CreateIndex
CREATE INDEX "LawFirm_slug_idx" ON "LawFirm"("slug");

-- CreateIndex
CREATE INDEX "FirmOffice_firmId_isActive_idx" ON "FirmOffice"("firmId", "isActive");

-- CreateIndex
CREATE INDEX "FirmMember_firmId_status_idx" ON "FirmMember"("firmId", "status");

-- CreateIndex
CREATE INDEX "FirmMember_userId_status_idx" ON "FirmMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FirmMember_firmId_userId_key" ON "FirmMember"("firmId", "userId");

-- CreateIndex
CREATE INDEX "Booking_firmId_status_idx" ON "Booking"("firmId", "status");

-- AddForeignKey
ALTER TABLE "LawyerProfile" ADD CONSTRAINT "LawyerProfile_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "LawFirm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmOffice" ADD CONSTRAINT "FirmOffice_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "LawFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmMember" ADD CONSTRAINT "FirmMember_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "LawFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmMember" ADD CONSTRAINT "FirmMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "LawFirm"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: every existing attorney becomes a firm of one.
--
-- Phase 2 makes the FIRM the provider of legal services. Every LawyerProfile
-- that existed before this migration must therefore end up inside a firm, with
-- no data loss and no visible change for a solo practitioner.
--
-- `LawyerProfile.baslNumber` is UNIQUE and NOT NULL, so it is used as the join
-- key between a profile and the firm created for it. That avoids having to
-- correlate generated uuids across statements.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. One firm per existing attorney.
INSERT INTO "LawFirm" (
    "id", "slug", "name", "firmType", "isSoloPractice", "principalBaslNumber",
    "description", "practiceAreas", "languages", "courts", "district",
    "contactPhone", "logoUrl",
    "verificationStatus", "verifiedAt", "isActive", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    -- Slug from the attorney's name, suffixed with a slice of their profile id
    -- so two attorneys with the same name cannot collide.
    trim(both '-' from regexp_replace(lower(lp."fullName"), '[^a-z0-9]+', '-', 'g'))
        || '-' || left(lp."id", 8),
    lp."fullName",
    'SOLE_PRACTITIONER',
    true,
    lp."baslNumber",
    lp."bio",
    lp."practiceAreas",
    lp."languages",
    lp."courts",
    lp."district",
    lp."contactPhone",
    lp."profileImageUrl",
    -- A firm of one inherits the standing of the attorney who is its only
    -- member: if we have already checked their BASL registration, the practice
    -- is verified to the same extent. A multi-member firm must be verified in
    -- its own right.
    CASE WHEN lp."isVerified" THEN 'VERIFIED'::"FirmVerificationStatus"
         ELSE 'UNVERIFIED'::"FirmVerificationStatus" END,
    CASE WHEN lp."isVerified" THEN CURRENT_TIMESTAMP ELSE NULL END,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "LawyerProfile" lp
WHERE lp."firmId" IS NULL;

-- 2. Point each attorney at their new firm.
UPDATE "LawyerProfile" lp
SET "firmId" = f."id"
FROM "LawFirm" f
WHERE f."principalBaslNumber" = lp."baslNumber"
  AND lp."firmId" IS NULL;

-- 3. The attorney is the owner of their own firm.
INSERT INTO "FirmMember" (
    "id", "firmId", "userId", "role", "status", "title",
    "joinedAt", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    lp."firmId",
    lp."userId",
    'FIRM_OWNER',
    'ACTIVE',
    'Principal',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "LawyerProfile" lp
WHERE lp."firmId" IS NOT NULL
ON CONFLICT ("firmId", "userId") DO NOTHING;

-- 4. Each firm's registered office, taken from the attorney's own address.
INSERT INTO "FirmOffice" (
    "id", "firmId", "label", "address", "district", "contactPhone",
    "isPrimary", "isActive", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    lp."firmId",
    'Main office',
    lp."address",
    lp."district",
    lp."contactPhone",
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "LawyerProfile" lp
WHERE lp."firmId" IS NOT NULL
  AND lp."address" IS NOT NULL
  AND lp."address" <> '';

-- 5. Every existing matter belongs to the firm of the attorney handling it.
--    `Booking.lawyerId` is unchanged — the client's original choice of attorney
--    is preserved exactly, which is the evidence that the choice was theirs.
--    See docs/restructure/LEGAL-GUARDRAILS.md (rule 4).
UPDATE "Booking" b
SET "firmId" = lp."firmId"
FROM "LawyerProfile" lp
WHERE lp."id" = b."lawyerId"
  AND b."firmId" IS NULL;
