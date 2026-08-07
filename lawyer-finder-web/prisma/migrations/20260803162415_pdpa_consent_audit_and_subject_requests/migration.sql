-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DEACTIVATED', 'ERASED');

-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('MARKETING_EMAIL', 'PRODUCT_ANALYTICS', 'AI_HISTORY_RETENTION');

-- CreateEnum
CREATE TYPE "AuditedResource" AS ENUM ('BOOKING', 'CONFLICT_CHECK', 'QUOTE', 'ENGAGEMENT_LETTER', 'FEE_NOTE', 'MESSAGE_THREAD', 'SUBJECT_REQUEST');

-- CreateEnum
CREATE TYPE "AuditedAction" AS ENUM ('READ_SUMMARY', 'READ_DETAIL', 'EXPORTED', 'RECTIFIED', 'ERASED');

-- CreateEnum
CREATE TYPE "SubjectRequestType" AS ENUM ('ACCESS', 'RECTIFICATION', 'ERASURE', 'PORTABILITY', 'OBJECTION');

-- CreateEnum
CREATE TYPE "SubjectRequestStatus" AS ENUM ('RECEIVED', 'IN_PROGRESS', 'AWAITING_FIRM', 'COMPLETED', 'PARTIALLY_FULFILLED', 'REFUSED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "erasedAt" TIMESTAMP(3),
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "noticeVersion" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "sourceIp" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataAccessLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "resource" "AuditedResource" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "action" "AuditedAction" NOT NULL,
    "bookingId" TEXT,
    "firmId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSubjectRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SubjectRequestType" NOT NULL,
    "status" "SubjectRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "requestNote" TEXT,
    "referredFirmIds" TEXT[],
    "dueBy" TIMESTAMP(3) NOT NULL,
    "outcomeNote" TEXT,
    "refusalReason" TEXT,
    "handledById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_purpose_withdrawnAt_idx" ON "ConsentRecord"("userId", "purpose", "withdrawnAt");

-- CreateIndex
CREATE INDEX "DataAccessLog_bookingId_createdAt_idx" ON "DataAccessLog"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "DataAccessLog_actorUserId_createdAt_idx" ON "DataAccessLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "DataAccessLog_firmId_createdAt_idx" ON "DataAccessLog"("firmId", "createdAt");

-- CreateIndex
CREATE INDEX "DataAccessLog_createdAt_idx" ON "DataAccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_userId_status_idx" ON "DataSubjectRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_status_dueBy_idx" ON "DataSubjectRequest"("status", "dueBy");

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
