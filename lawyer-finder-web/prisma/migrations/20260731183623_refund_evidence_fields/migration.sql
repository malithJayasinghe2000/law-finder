-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "refundConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "refundDisputeReason" TEXT,
ADD COLUMN     "refundDisputedAt" TIMESTAMP(3),
ADD COLUMN     "refundMethod" TEXT,
ADD COLUMN     "refundProofUrl" TEXT,
ADD COLUMN     "refundReference" TEXT,
ADD COLUMN     "refundSentOn" TEXT;
