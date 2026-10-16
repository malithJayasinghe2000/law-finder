-- Data only. Every advert defaulted its button to "View Profile", wording from
-- when attorneys bought profile ads. An advert links out to a non-legal
-- advertiser's own site (2026-10-16).
UPDATE "AdCampaign" SET "ctaText" = 'Learn more' WHERE "ctaText" = 'View Profile';
