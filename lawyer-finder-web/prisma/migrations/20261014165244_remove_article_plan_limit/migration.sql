-- Remove the "articles" plan limit and the four article permissions.
--
-- Nothing in the app can write an Article (lawyers write community posts,
-- which no tier limits), so these gated nothing. And tiers that let a firm
-- publish more about itself for more money were selling visibility to
-- attorneys — LEGAL-GUARDRAILS.md rule 3. The live pricing page showed
-- "10 articles/mo" and "50 articles/mo".
--
-- Data only; no table changes. Usage rows first (FeatureUsage -> Feature has
-- no cascade).

DELETE FROM "FeatureUsage"
WHERE "featureId" IN (SELECT "id" FROM "Feature" WHERE "name" = 'articles_per_month');

DELETE FROM "FeatureLimitConfig" WHERE "featureName" = 'articles_per_month';

DELETE FROM "Feature" WHERE "name" = 'articles_per_month';

DELETE FROM "SubscriptionRolePermission"
WHERE "permissionId" IN (
  SELECT "id" FROM "Permission"
  WHERE "name" IN ('create_article', 'edit_article', 'delete_article', 'publish_article')
);

DELETE FROM "Permission"
WHERE "name" IN ('create_article', 'edit_article', 'delete_article', 'publish_article');
