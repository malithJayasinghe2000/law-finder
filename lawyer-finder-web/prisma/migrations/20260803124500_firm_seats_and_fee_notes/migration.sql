-- Phase 3 (remainder) — the firm buys seats, and issues its own fee notes.
--
-- Three changes, all following from the same sentence: the firm provides the
-- legal service and we provide software.
--
--   1. A subscription belongs to a LawFirm, not to a LawyerProfile. An attorney
--      does not buy a licence to get work; the practice buys software, and the
--      attorney's access follows from membership of it.
--   2. A firm can issue a fee note to its own client, under its own TIN and VAT
--      number, payable to its own bank account. We render the document and are
--      not party to the transaction.
--   3. ConsultationPricing loses its two price columns — the last published
--      "buy a consultation at this price" fields in the schema.
--
-- See docs/restructure/LEGAL-GUARDRAILS.md (rules 1, 2 and 7).

-- ───────────────────────────────────────────────────────────────────────────
-- 1. The firm's tax identity
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "LawFirm" ADD COLUMN "taxIdentificationNumber" TEXT;
ALTER TABLE "LawFirm" ADD COLUMN "vatNumber" TEXT;
ALTER TABLE "LawFirm" ADD COLUMN "isVatRegistered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LawFirm" ADD COLUMN "vatRatePercent" INTEGER;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Subscription: LawyerProfile -> LawFirm
-- ───────────────────────────────────────────────────────────────────────────

-- Guard. Every attorney has had a firm since the Phase 2 backfill, so this
-- should be a no-op — but a subscription we cannot attribute to a firm would be
-- silently dropped by the join below, and a customer losing their licence
-- without anyone noticing is exactly the failure worth being loud about.
DO $$
DECLARE orphans INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphans
  FROM "Subscription" s
  JOIN "LawyerProfile" p ON p.id = s."lawyerId"
  WHERE p."firmId" IS NULL;

  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot move % subscription(s) to a firm: the owning attorney has no firmId. Run the Phase 2 firm provisioning first.', orphans;
  END IF;
END $$;

ALTER TABLE "Subscription" ADD COLUMN "firmId" TEXT;

UPDATE "Subscription" s
SET "firmId" = p."firmId"
FROM "LawyerProfile" p
WHERE p.id = s."lawyerId";

-- Where several attorneys at the SAME firm each bought their own licence, the
-- firm now has more than one. Keep the most valuable as ACTIVE and stand the
-- others down.
--
-- Deliberately non-destructive: the stood-down rows keep their existing
-- endDate, and the application treats a CANCELED subscription as still valid
-- until that date. Nobody loses access they have already paid for; they simply
-- stop being the row that answers "what is this firm on?".
UPDATE "Subscription" s
SET "status" = 'CANCELED'
WHERE s."status" = 'ACTIVE'
  AND s.id <> (
    SELECT keep.id
    FROM "Subscription" keep
    JOIN "SubscriptionPlan" pl ON pl.id = keep."planId"
    WHERE keep."firmId" = s."firmId"
      AND keep."status" = 'ACTIVE'
    ORDER BY pl."monthlyAmount" DESC, keep."createdAt" DESC, keep.id DESC
    LIMIT 1
  );

ALTER TABLE "Subscription" ALTER COLUMN "firmId" SET NOT NULL;

ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_lawyerId_fkey";
ALTER TABLE "Subscription" DROP COLUMN "lawyerId";

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_firmId_fkey"
  FOREIGN KEY ("firmId") REFERENCES "LawFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Subscription_firmId_status_idx" ON "Subscription"("firmId", "status");

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Invoice: billed to the firm; the attorney becomes "who raised it"
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "Invoice" ADD COLUMN "firmId" TEXT;

UPDATE "Invoice" i
SET "firmId" = p."firmId"
FROM "LawyerProfile" p
WHERE p.id = i."lawyerId";

-- An invoice we cannot attribute to a firm is a billing record with no
-- counterparty. Fail rather than guess.
DO $$
DECLARE orphans INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "Invoice" WHERE "firmId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION 'Cannot attribute % invoice(s) to a firm.', orphans;
  END IF;
END $$;

ALTER TABLE "Invoice" ALTER COLUMN "firmId" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "lawyerId" DROP NOT NULL;

ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_lawyerId_fkey";
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_lawyerId_fkey"
  FOREIGN KEY ("lawyerId") REFERENCES "LawyerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_firmId_fkey"
  FOREIGN KEY ("firmId") REFERENCES "LawFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Invoice_firmId_status_idx" ON "Invoice"("firmId", "status");

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Fee notes — the firm's own invoice to its own client
-- ───────────────────────────────────────────────────────────────────────────
CREATE TYPE "FeeNoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'SETTLED', 'CANCELLED');

CREATE TABLE "FeeNote" (
    "id" TEXT NOT NULL,
    "noteNumber" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "quoteId" TEXT,

    "firmName" TEXT NOT NULL,
    "firmAddress" TEXT,
    "firmTin" TEXT,
    "firmVatNumber" TEXT,
    "firmBankName" TEXT,
    "firmAccountName" TEXT,
    "firmAccountNumber" TEXT,
    "firmBankBranch" TEXT,

    "clientName" TEXT NOT NULL,
    "clientAddress" TEXT,
    "clientEmail" TEXT,
    "attorneyName" TEXT,

    "lineItems" JSONB NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "vatRatePercent" INTEGER,
    "vatAmount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LKR',

    "status" "FeeNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "settlementNote" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationNote" TEXT,
    "content" TEXT,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeeNote_noteNumber_key" ON "FeeNote"("noteNumber");
CREATE INDEX "FeeNote_firmId_status_idx" ON "FeeNote"("firmId", "status");
CREATE INDEX "FeeNote_bookingId_idx" ON "FeeNote"("bookingId");

ALTER TABLE "FeeNote" ADD CONSTRAINT "FeeNote_firmId_fkey"
  FOREIGN KEY ("firmId") REFERENCES "LawFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeeNote" ADD CONSTRAINT "FeeNote_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeeNote" ADD CONSTRAINT "FeeNote_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. ConsultationPricing loses its price columns
-- ───────────────────────────────────────────────────────────────────────────
-- Forced to 0 since Phase 0 and read by nothing. A fee exists only on a Quote,
-- issued after a conflict check, for one matter. A price column on a lawyer's
-- profile is one product decision away from a fee range on a public page, which
-- the Rule 40 content limit does not permit.
ALTER TABLE "ConsultationPricing" DROP COLUMN "physicalPrice";
ALTER TABLE "ConsultationPricing" DROP COLUMN "onlinePrice";
