-- Phase 5 — AI compliance.
--
-- `sources` and `lawyerSuggestions` are dropped rather than migrated, and that
-- is the point of the migration rather than a side effect of it.
--
-- Both columns were written from the request body of
-- POST /api/ai-chat/conversations/[id]/messages, which the browser called after
-- generating an answer against the RAG service directly. Their contents are
-- therefore whatever the client said they were. Carrying them forward into
-- `citations` — a column whose meaning is "this was checked by
-- src/lib/ai/policy.ts" — would relabel unverified data as verified, which is
-- the exact false authority Phase 5 exists to prevent.
--
-- `lawyerSuggestions` is deleted outright and not replaced. The assistant no
-- longer surfaces practitioners at all: choosing on the basis of what a person
-- described about their legal problem is the platform choosing (guardrail rule
-- 4) and targeting on privileged material (rule 5). Restoring it takes a
-- migration and a conversation, not a feature flag.
--
-- Historic message text is untouched. Only the citation payload goes.

ALTER TABLE "AiMessage" DROP COLUMN "sources";
ALTER TABLE "AiMessage" DROP COLUMN "lawyerSuggestions";

ALTER TABLE "AiMessage" ADD COLUMN "citations" JSONB;
ALTER TABLE "AiMessage" ADD COLUMN "refusalCategory" TEXT;

CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");
