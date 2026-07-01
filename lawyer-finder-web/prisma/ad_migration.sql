-- Step 1: Update existing AdPlacement values to new ones
UPDATE "AdCampaign" SET placement = 'HOMEPAGE_BELOW_HERO' WHERE placement IN ('HOMEPAGE_HERO', 'HOMEPAGE_MID');
UPDATE "AdCampaign" SET placement = 'BLOG_RIGHT_SIDEBAR' WHERE placement = 'BLOG_SIDEBAR';
UPDATE "AdCampaign" SET placement = 'BLOG_TOP_BANNER' WHERE placement = 'BLOG_FEED';
-- BLOG_POST_BOTTOM stays the same, DIRECTORY_TOP stays, DIRECTORY_INLINE stays

-- Step 2: Update existing AdType values to new ones
UPDATE "AdCampaign" SET type = 'BANNER_IMAGE' WHERE type = 'BANNER';
UPDATE "AdCampaign" SET type = 'PROFILE_CARD' WHERE type IN ('SPONSORED_LISTING', 'FEATURED_PROFILE');
UPDATE "AdCampaign" SET type = 'SIDEBAR_CARD' WHERE type IN ('IN_FEED', 'SIDEBAR');

-- Step 3: Rename old enum values to new ones for AdPlacement
ALTER TYPE "AdPlacement" RENAME VALUE 'HOMEPAGE_HERO' TO 'HOMEPAGE_BELOW_HERO';
ALTER TYPE "AdPlacement" ADD VALUE IF NOT EXISTS 'CHAT_RIGHT_SIDEBAR';
ALTER TYPE "AdPlacement" ADD VALUE IF NOT EXISTS 'BLOG_TOP_BANNER';
ALTER TYPE "AdPlacement" RENAME VALUE 'BLOG_SIDEBAR' TO 'BLOG_RIGHT_SIDEBAR';
ALTER TYPE "AdPlacement" ADD VALUE IF NOT EXISTS 'BLOG_BOTTOM_STICKY';
ALTER TYPE "AdPlacement" ADD VALUE IF NOT EXISTS 'BLOG_POST_SIDEBAR';
ALTER TYPE "AdPlacement" RENAME VALUE 'BLOG_FEED' TO 'BLOG_TOP_BANNER_OLD';

-- Step 4: Rename old enum values for AdType
ALTER TYPE "AdType" RENAME VALUE 'BANNER' TO 'BANNER_IMAGE';
ALTER TYPE "AdType" RENAME VALUE 'SPONSORED_LISTING' TO 'PROFILE_CARD';
ALTER TYPE "AdType" ADD VALUE IF NOT EXISTS 'SIDEBAR_CARD';
ALTER TYPE "AdType" ADD VALUE IF NOT EXISTS 'STICKY_BAR';

-- Step 5: Create new tables
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
    "updatedAt" TIMESTAMP(3) NOT NULL,
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

ALTER TABLE "AdSlotBooking" ADD CONSTRAINT "AdSlotBooking_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
