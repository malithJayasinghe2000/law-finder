-- CreateEnum
CREATE TYPE "FirmInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED');

-- AlterTable
ALTER TABLE "LawFirm" ADD COLUMN     "isRegisteredPractice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "registeredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FirmInvitation" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "FirmRole" NOT NULL,
    "title" TEXT,
    "token" TEXT NOT NULL,
    "status" "FirmInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FirmInvitation_token_key" ON "FirmInvitation"("token");

-- CreateIndex
CREATE INDEX "FirmInvitation_email_status_idx" ON "FirmInvitation"("email", "status");

-- CreateIndex
CREATE INDEX "FirmInvitation_status_expiresAt_idx" ON "FirmInvitation"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FirmInvitation_firmId_email_key" ON "FirmInvitation"("firmId", "email");

-- AddForeignKey
ALTER TABLE "FirmInvitation" ADD CONSTRAINT "FirmInvitation_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "LawFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
