-- Data only. PROFILE_CARD was the attorney-profile-shaped advert removed in
-- Phase 4; it had no placement left but the homepage slot's stored config still
-- listed it, and the config page showed it as an allowed type (2026-10-16).
-- The AdType enum value stays: no campaign may use it (src/schemas/ad.schema.ts).
UPDATE "AdPlacementConfig"
SET "allowedAdTypes" = array_remove("allowedAdTypes", 'PROFILE_CARD'::"AdType")
WHERE 'PROFILE_CARD'::"AdType" = ANY("allowedAdTypes");
