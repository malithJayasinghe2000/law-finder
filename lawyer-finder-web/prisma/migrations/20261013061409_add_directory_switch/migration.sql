-- CreateTable
CREATE TABLE "DirectorySwitch" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectorySwitch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectorySwitch_createdAt_idx" ON "DirectorySwitch"("createdAt");
