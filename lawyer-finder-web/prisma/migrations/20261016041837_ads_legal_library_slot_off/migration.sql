-- Data only. The legal-library ad slot is rendered on no page and no ad type
-- may use it, but its config was ACTIVE and priced at LKR 2,500 a day (2026-10-16).
UPDATE "AdPlacementConfig" SET "isActive" = false, "allowedAdTypes" = '{}'
WHERE "placement" = 'LEGAL_LIBRARY_SIDEBAR';
