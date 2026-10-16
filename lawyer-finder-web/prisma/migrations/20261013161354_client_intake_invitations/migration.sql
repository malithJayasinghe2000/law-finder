-- CreateTable
CREATE TABLE "ClientIntakeInvitation" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT,
    "description" TEXT,
    "practiceArea" TEXT,
    "mode" "ConsultationMode" NOT NULL,
    "attorneyId" TEXT,
    "token" TEXT NOT NULL,
    "status" "FirmInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientIntakeInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientIntakeInvitation_token_key" ON "ClientIntakeInvitation"("token");

-- CreateIndex
CREATE INDEX "ClientIntakeInvitation_firmId_status_idx" ON "ClientIntakeInvitation"("firmId", "status");

-- CreateIndex
CREATE INDEX "ClientIntakeInvitation_email_status_idx" ON "ClientIntakeInvitation"("email", "status");

-- AddForeignKey
ALTER TABLE "ClientIntakeInvitation" ADD CONSTRAINT "ClientIntakeInvitation_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "LawFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
