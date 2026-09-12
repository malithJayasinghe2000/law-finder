-- CreateEnum
CREATE TYPE "FirmSubjectResponseOutcome" AS ENUM ('RELEASED', 'ERASED', 'REFUSED_RETAINED', 'PARTIAL', 'NO_DATA');

-- CreateTable
CREATE TABLE "SubjectRequestFirmResponse" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "outcome" "FirmSubjectResponseOutcome" NOT NULL,
    "reason" TEXT NOT NULL,
    "respondedById" TEXT,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectRequestFirmResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubjectRequestFirmResponse_firmId_respondedAt_idx" ON "SubjectRequestFirmResponse"("firmId", "respondedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectRequestFirmResponse_requestId_firmId_key" ON "SubjectRequestFirmResponse"("requestId", "firmId");

-- AddForeignKey
ALTER TABLE "SubjectRequestFirmResponse" ADD CONSTRAINT "SubjectRequestFirmResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DataSubjectRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectRequestFirmResponse" ADD CONSTRAINT "SubjectRequestFirmResponse_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "LawFirm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
