-- Step 3: Migrate data for old enum values that were renamed
UPDATE "AdCampaign" SET placement = 'HOMEPAGE_BELOW_HERO' WHERE placement = 'HOMEPAGE_MID';
UPDATE "AdCampaign" SET type = 'SIDEBAR_CARD' WHERE type IN ('FEATURED_PROFILE', 'IN_FEED', 'SIDEBAR');

-- Step 4: Create new tables
CREATE TABLE IF NOT EXISTS "AdPlacementConfig" (
    "id" TEXT NOT NULL,
    "placement" "AdPlacement" NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "pricePerDay" INTEGER NOT NULL,
    "isSlider" BOOLEAN NOT NULL DEFAULT false,
    "sliderInterval" INTEGER NOT NULL DEFAULT 3000,
    "maxAdsPerSlot" INTEGER NOT NULL DEFAULT 3,
    "recommendedWidth" INTEGER,
    "recommendedHeight" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowedAdTypes" "AdType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdPlacementConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdPlacementConfig_placement_key" ON "AdPlacementConfig"("placement");

CREATE TABLE IF NOT EXISTS "AdSlotBooking" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "placement" "AdPlacement" NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdSlotBooking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdSlotBooking_placement_date_campaignId_key" ON "AdSlotBooking"("placement", "date", "campaignId");
CREATE INDEX IF NOT EXISTS "AdSlotBooking_placement_date_idx" ON "AdSlotBooking"("placement", "date");

ALTER TABLE "AdSlotBooking" DROP CONSTRAINT IF EXISTS "AdSlotBooking_campaignId_fkey";
ALTER TABLE "AdSlotBooking" ADD CONSTRAINT "AdSlotBooking_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
