-- AlterTable
ALTER TABLE "LawyerProfile" ADD COLUMN     "verificationRevokedAt" TIMESTAMP(3),
ADD COLUMN     "verificationRevokedById" TEXT,
ADD COLUMN     "verificationRevokedReason" TEXT;
