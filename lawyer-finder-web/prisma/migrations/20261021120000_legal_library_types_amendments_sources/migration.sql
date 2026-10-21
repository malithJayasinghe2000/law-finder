-- Legal Library: document types instead of "Acts & Ordinances" / "Amendment Acts",
-- subjects, the link from an amending Act to the law it amends, where each text
-- came from, and Parliament's Acts listing as a review queue.
--
-- Hand-edited: Prisma's generated enum swap casts old values to new ones and
-- would fail on every row using a removed value.

-- CreateEnum
CREATE TYPE "LegalSubject" AS ENUM ('CONSTITUTIONAL', 'CRIMINAL', 'CIVIL_PROCEDURE', 'FAMILY', 'LAND_PROPERTY', 'LABOUR', 'BUSINESS', 'TAX_FINANCE', 'CONSUMER', 'MOTOR_TRAFFIC', 'ENVIRONMENT', 'ADMINISTRATIVE');

-- CreateEnum
CREATE TYPE "ParliamentActStatus" AS ENUM ('NEW', 'IMPORTED', 'DISMISSED');

-- AlterEnum
BEGIN;
CREATE TYPE "LegalDocumentCategory_new" AS ENUM ('CONSTITUTION', 'ACT', 'ORDINANCE', 'REGULATION', 'PROVINCIAL_STATUTE', 'GAZETTE_NOTIFICATIONS', 'COURT_RULES', 'SRI_LANKA_LAW_REPORTS', 'SUPREME_COURT_DECISIONS', 'COURT_OF_APPEAL_DECISIONS', 'HIGH_COURT_DECISIONS');
-- The two removed values are mapped, not cast: "Acts & Ordinances" splits by
-- title, and an "Amendment Act" is an ACT (its link to the law it amends is
-- amendsId, set by an admin).
ALTER TABLE "LegalDocument" ALTER COLUMN "category" TYPE "LegalDocumentCategory_new" USING (
  CASE "category"::text
    WHEN 'ACTS_AND_ORDINANCES' THEN
      CASE WHEN "title" ILIKE '%ordinance%' THEN 'ORDINANCE' ELSE 'ACT' END
    WHEN 'AMENDMENT_ACTS' THEN 'ACT'
    ELSE "category"::text
  END
)::"LegalDocumentCategory_new";
ALTER TYPE "LegalDocumentCategory" RENAME TO "LegalDocumentCategory_old";
ALTER TYPE "LegalDocumentCategory_new" RENAME TO "LegalDocumentCategory";
DROP TYPE "public"."LegalDocumentCategory_old";
COMMIT;

-- AlterEnum
ALTER TYPE "LegalDocumentStatus" ADD VALUE 'AWAITING_ORIGINAL';

-- AlterTable
ALTER TABLE "LegalDocument" ADD COLUMN     "amendsId" TEXT,
ADD COLUMN     "consolidatedToYear" INTEGER,
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "sourceName" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "subjects" "LegalSubject"[] DEFAULT ARRAY[]::"LegalSubject"[];

-- CreateTable
CREATE TABLE "ParliamentAct" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "actNumber" TEXT,
    "year" INTEGER,
    "title" TEXT NOT NULL,
    "endorsedOn" TIMESTAMP(3),
    "pdfUrl" TEXT NOT NULL,
    "detailUrl" TEXT NOT NULL,
    "isAmendment" BOOLEAN NOT NULL,
    "suggestedAmendsId" TEXT,
    "status" "ParliamentActStatus" NOT NULL DEFAULT 'NEW',
    "legalDocumentId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,

    CONSTRAINT "ParliamentAct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParliamentAct_ref_key" ON "ParliamentAct"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "ParliamentAct_legalDocumentId_key" ON "ParliamentAct"("legalDocumentId");

-- CreateIndex
CREATE INDEX "ParliamentAct_status_idx" ON "ParliamentAct"("status");

-- CreateIndex
CREATE INDEX "ParliamentAct_year_idx" ON "ParliamentAct"("year");

-- CreateIndex
CREATE INDEX "LegalDocument_amendsId_idx" ON "LegalDocument"("amendsId");

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_amendsId_fkey" FOREIGN KEY ("amendsId") REFERENCES "LegalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParliamentAct" ADD CONSTRAINT "ParliamentAct_legalDocumentId_fkey" FOREIGN KEY ("legalDocumentId") REFERENCES "LegalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- "year" used to mean "consolidated to" for the consolidated texts. It now means
-- the year enacted; a consolidation's year moves to consolidatedToYear.
UPDATE "LegalDocument"
SET "consolidatedToYear" = "year", "year" = NULL
WHERE "fileName" ILIKE '%consolidat%' AND "year" IS NOT NULL;
