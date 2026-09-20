-- ============================================================================
-- Drop the unauthenticated `Inquiry` intake. (Phase 7, DATA-INVENTORY §7 finding A.)
--
-- `POST /api/inquiries` accepted a person's name, phone number, email and a
-- free-text description of their legal problem, addressed to a named attorney,
-- with no sign-in, no rate limit, no firm scoping, no privilege gate and no
-- retention. It sat outside every access control in the system.
--
-- WHY THE ROWS ARE DELETED RATHER THAN MIGRATED. An enquiry created no retainer
-- and no obligation on anyone, so there is no lawful basis to keep holding a
-- stranger's account of their legal problem, and no matter file for it to
-- become part of. Under the PDPA, deleting data we have no basis to hold is the
-- correct answer rather than a loss. This is our own controller data, so we may
-- act on it — contrast `assertPurgeable()`, which refuses firm-controlled data.
--
-- The replacement (firm-first intake) already existed before this ran; the
-- entry points were rewritten to point at it in the same change set, so no
-- working flow was broken to make a legal fix.
-- ============================================================================

/*
  Warnings:

  - You are about to drop the `Inquiry` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Inquiry" DROP CONSTRAINT "Inquiry_lawyerId_fkey";

-- DropTable
DROP TABLE "Inquiry";

-- DropEnum
DROP TYPE "InquiryStatus";
