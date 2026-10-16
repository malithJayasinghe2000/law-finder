-- Data only: placement names and descriptions used a long dash ("—"); the site now
-- uses a plain hyphen in all visible text. Nothing structural changes.
UPDATE "AdPlacementConfig" SET "displayName" = REPLACE("displayName", ' — ', ' - ') WHERE "displayName" LIKE '%—%';
UPDATE "AdPlacementConfig" SET "description" = REPLACE("description", ' — ', ' - ') WHERE "description" LIKE '%—%';
