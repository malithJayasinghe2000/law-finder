-- Drop `LawyerProfile.subscriptionId`.
--
-- A vestigial scalar with no foreign key behind it: the relation was always
-- `Subscription[]` keyed the other way, so this column pointed at nothing and
-- was read by nothing. Every `subscriptionId` in the codebase belongs to
-- `FeatureUsage` or `SubscriptionDetails`.
--
-- It is dropped now rather than left alone because a subscription is a property
-- of a firm as of the previous migration, so a subscription id hanging off an
-- individual attorney is actively misleading about where a licence lives.
--
-- Separate from 20260803124500 rather than folded into it: that migration had
-- already been applied, and the rule in docs/database-migrations.md is that a
-- wrong migration is fixed by a new one, never by editing an applied file.

ALTER TABLE "LawyerProfile" DROP COLUMN IF EXISTS "subscriptionId";
