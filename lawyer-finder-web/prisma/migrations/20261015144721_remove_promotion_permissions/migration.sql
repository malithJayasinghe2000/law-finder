-- Remove the two "promotion" permissions from the licence plans.
--
-- They gated nothing (attorneys cannot place adverts; only platform staff can,
-- and only for non-legal advertisers), but the pricing page listed "Access paid
-- promotion features" and "Create promotional campaigns" as features of the
-- dearer tier. Offering attorneys paid visibility is LEGAL-GUARDRAILS.md rule 3,
-- whether or not the feature works.
--
-- Data only; no table changes.

DELETE FROM "SubscriptionRolePermission"
WHERE "permissionId" IN (
  SELECT "id" FROM "Permission" WHERE "name" IN ('access_paid_promo', 'create_promo')
);

DELETE FROM "Permission" WHERE "name" IN ('access_paid_promo', 'create_promo');
