-- Data only. Community icons were emoji typed into a free-text box; they are
-- now keys into a fixed set of line icons (src/lib/community/icons.ts). Seeded
-- communities get their matching icon; anything else gets the default
-- ('discussion'). No icon shows a person (2026-10-16).
UPDATE "Community" SET "icon" = CASE "name"
  WHEN 'family-law'         THEN 'document'
  WHEN 'property-law'       THEN 'house'
  WHEN 'criminal-law'       THEN 'scale'
  WHEN 'labour-law'         THEN 'hard-hat'
  WHEN 'commercial-law'     THEN 'briefcase'
  WHEN 'motor-traffic'      THEN 'signpost'
  WHEN 'banking-finance'    THEN 'landmark'
  WHEN 'constitutional-law' THEN 'scroll'
  WHEN 'immigration'        THEN 'plane'
  WHEN 'legal-general'      THEN 'book'
  ELSE 'discussion'
END
WHERE "icon" IS NULL OR "icon" NOT IN
  ('scale','house','landmark','briefcase','scroll','plane','signpost','document','hard-hat','book','discussion');
