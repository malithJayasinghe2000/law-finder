-- Remove the three "inquiry" permissions left in the database.
--
-- The seed stopped creating them in Phase 7 along with the Inquiry model, but no
-- migration removed the rows, so the Enterprise plan still listed "Receive client
-- inquiries" — a dearer tier receiving more clients is pay-per-lead
-- (LEGAL-GUARDRAILS.md rules 1 and 3). Nothing in the code reads them.
--
-- Data only; no table changes.

DELETE FROM "SubscriptionRolePermission"
WHERE "permissionId" IN (
  SELECT "id" FROM "Permission"
  WHERE "name" IN ('receive_inquiries', 'post_inquiry', 'manage_inquiries')
);

DELETE FROM "Permission" WHERE "name" IN ('receive_inquiries', 'post_inquiry', 'manage_inquiries');
