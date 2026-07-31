-- CreateTable
CREATE TABLE "EngagementLetter" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "firmName" TEXT NOT NULL,
    "firmBaslNumber" TEXT NOT NULL,
    "firmAddress" TEXT,
    "firmContact" TEXT,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "matterSubject" TEXT NOT NULL,
    "scopeOfWork" TEXT NOT NULL,
    "exclusions" TEXT,
    "feeBasis" "FeeBasis" NOT NULL,
    "feeAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "paymentTerms" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngagementLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EngagementLetter_bookingId_key" ON "EngagementLetter"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementLetter_quoteId_key" ON "EngagementLetter"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementLetter_reference_key" ON "EngagementLetter"("reference");

-- CreateIndex
CREATE INDEX "EngagementLetter_reference_idx" ON "EngagementLetter"("reference");

-- AddForeignKey
ALTER TABLE "EngagementLetter" ADD CONSTRAINT "EngagementLetter_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementLetter" ADD CONSTRAINT "EngagementLetter_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
