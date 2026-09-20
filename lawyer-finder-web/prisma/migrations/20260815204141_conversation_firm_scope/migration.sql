-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "bookingId" TEXT,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "firmId" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_firmId_updatedAt_idx" ON "Conversation"("firmId", "updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_clientId_updatedAt_idx" ON "Conversation"("clientId", "updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_bookingId_idx" ON "Conversation"("bookingId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "LawFirm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Backfill: attach every existing thread to a firm, a client, and where
-- possible a matter.
--
-- Without this, every conversation that already exists keeps `firmId = NULL`
-- and falls into the grandfathered branch of `resolveConversationAccess`
-- forever — which means the hole this migration exists to close (an attorney
-- who leaves a firm keeps reading its clients' threads) would stay open for all
-- historic data while looking fixed for new data. That is a worse outcome than
-- not shipping it, because it reads as done.
-- ============================================================================

-- 1. The client. The participant whose User.role is CLIENT.
--    Threads with no client participant (they should not exist) are left NULL
--    and remain participants-only, which is the safe direction.
UPDATE "Conversation" c
SET "clientId" = sub."userId"
FROM (
  SELECT DISTINCT ON (cp."conversationId") cp."conversationId", cp."userId"
  FROM "ConversationParticipant" cp
  JOIN "User" u ON u."id" = cp."userId"
  WHERE u."role" = 'CLIENT'
  ORDER BY cp."conversationId", cp."createdAt" ASC
) AS sub
WHERE c."id" = sub."conversationId";

-- 2. The firm. Taken from the LawyerProfile of the attorney participant.
--    An attorney with no firm (pre-Phase-2 leftovers) leaves this NULL.
UPDATE "Conversation" c
SET "firmId" = sub."firmId"
FROM (
  SELECT DISTINCT ON (cp."conversationId") cp."conversationId", lp."firmId"
  FROM "ConversationParticipant" cp
  JOIN "User" u ON u."id" = cp."userId"
  JOIN "LawyerProfile" lp ON lp."userId" = u."id"
  WHERE u."role" = 'LAWYER' AND lp."firmId" IS NOT NULL
  ORDER BY cp."conversationId", cp."createdAt" ASC
) AS sub
WHERE c."id" = sub."conversationId";

-- 3. The matter, where exactly one matter links this client to this firm.
--    Deliberately only where there is exactly one: guessing which of a client's
--    three matters a conversation concerns would put the wrong file reference on
--    privileged correspondence, and "no matter linked" is honest whereas a wrong
--    link is not.
UPDATE "Conversation" c
SET "bookingId" = sub."bookingId"
FROM (
  SELECT b."clientId", b."firmId", MIN(b."id") AS "bookingId"
  FROM "Booking" b
  GROUP BY b."clientId", b."firmId"
  HAVING COUNT(*) = 1
) AS sub
WHERE c."clientId" = sub."clientId"
  AND c."firmId" = sub."firmId"
  AND c."bookingId" IS NULL;
