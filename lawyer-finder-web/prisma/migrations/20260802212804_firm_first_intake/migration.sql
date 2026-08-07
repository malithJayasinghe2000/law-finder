-- ─────────────────────────────────────────────────────────────────────────────
-- Firm-first intake.
--
-- Before this migration a matter could only exist by a client picking an
-- individual attorney and one of their published time slots. That is a
-- marketplace-booking shape: it holds a diary slot before the firm has decided
-- whether it can even act, and it makes the individual — not the firm — look
-- like the provider of legal services.
--
-- After it, a client may engage the FIRM. `lawyerId` becomes nullable (null =
-- sitting in the firm's queue), the schedule becomes nullable (no appointment
-- until the firm proposes one with its quote), and `firmId` becomes required
-- because a matter always belongs to a firm even before anyone is assigned.
--
-- `clientSelectedAttorneyId` is new and immutable: it records whether the CLIENT
-- chose the practitioner, and survives any later reassignment by the firm. That
-- is the evidence for guardrail rule 4 — the platform never chooses the lawyer.
-- ─────────────────────────────────────────────────────────────────────────────

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_firmId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_lawyerId_fkey";

-- AlterTable: add the new column on its own first, so it can be backfilled
-- before any nullability changes.
ALTER TABLE "Booking" ADD COLUMN "clientSelectedAttorneyId" TEXT;

-- Backfill: every matter that existed before this migration was created by a
-- client choosing a specific attorney from the directory — that was the only
-- path in. Recording it keeps the rule 4 evidence for historic matters, which
-- would otherwise be lost the first time a firm reassigned one.
UPDATE "Booking"
SET "clientSelectedAttorneyId" = "lawyerId"
WHERE "clientSelectedAttorneyId" IS NULL
  AND "lawyerId" IS NOT NULL;

-- Backfill: `firmId` is about to become NOT NULL. The law_firm_entity migration
-- already populated it, but a matter created between the two migrations would
-- not have one. Derive it from the responsible attorney's firm rather than
-- letting the ALTER fail on live data.
UPDATE "Booking" b
SET "firmId" = lp."firmId"
FROM "LawyerProfile" lp
WHERE lp."id" = b."lawyerId"
  AND b."firmId" IS NULL
  AND lp."firmId" IS NOT NULL;

-- AlterTable
ALTER TABLE "Booking"
ALTER COLUMN "lawyerId" DROP NOT NULL,
ALTER COLUMN "date" DROP NOT NULL,
ALTER COLUMN "startTime" DROP NOT NULL,
ALTER COLUMN "endTime" DROP NOT NULL,
ALTER COLUMN "duration" DROP NOT NULL,
ALTER COLUMN "firmId" SET NOT NULL;

-- AlterTable: the appointment an attorney proposes when quoting on a matter that
-- arrived without a slot.
ALTER TABLE "Quote" ADD COLUMN     "proposedDate" DATE,
ADD COLUMN     "proposedEndTime" TEXT,
ADD COLUMN     "proposedStartTime" TEXT;

-- CreateIndex: the firm's unassigned queue.
CREATE INDEX "Booking_firmId_lawyerId_idx" ON "Booking"("firmId", "lawyerId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "LawyerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "LawFirm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
