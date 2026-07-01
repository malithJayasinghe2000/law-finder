-- Step 4: Drop deprecated enum values using the recreate-enum approach
-- PostgreSQL doesn't support DROP VALUE, so we need to recreate the enums

-- First, handle AdPlacement: remove HOMEPAGE_MID (data already migrated to HOMEPAGE_BELOW_HERO)
-- We need to recreate the enum without HOMEPAGE_MID
ALTER TYPE "AdPlacement" RENAME TO "AdPlacement_old";
CREATE TYPE "AdPlacement" AS ENUM (
  'HOMEPAGE_BELOW_HERO',
  'CHAT_RIGHT_SIDEBAR',
  'BLOG_TOP_BANNER',
  'BLOG_RIGHT_SIDEBAR',
  'BLOG_BOTTOM_STICKY',
  'BLOG_POST_SIDEBAR',
  'BLOG_POST_BOTTOM',
  'DIRECTORY_TOP',
  'DIRECTORY_INLINE'
);
ALTER TABLE "AdCampaign" ALTER COLUMN "placement" TYPE "AdPlacement" USING "placement"::text::"AdPlacement";
ALTER TABLE "AdPlacementConfig" ALTER COLUMN "placement" TYPE "AdPlacement" USING "placement"::text::"AdPlacement";
ALTER TABLE "AdSlotBooking" ALTER COLUMN "placement" TYPE "AdPlacement" USING "placement"::text::"AdPlacement";
DROP TYPE "AdPlacement_old";

-- Then, handle AdType: remove FEATURED_PROFILE, IN_FEED, SIDEBAR
ALTER TYPE "AdType" RENAME TO "AdType_old";
CREATE TYPE "AdType" AS ENUM (
  'BANNER_IMAGE',
  'PROFILE_CARD',
  'SIDEBAR_CARD',
  'STICKY_BAR'
);
ALTER TABLE "AdCampaign" ALTER COLUMN "type" TYPE "AdType" USING "type"::text::"AdType";
ALTER TABLE "AdPlacementConfig" ALTER COLUMN "allowedAdTypes" TYPE "AdType"[] USING "allowedAdTypes"::text[]::"AdType"[];
DROP TYPE "AdType_old";
