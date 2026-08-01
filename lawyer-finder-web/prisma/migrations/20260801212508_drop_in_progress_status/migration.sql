-- AlterEnum
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM ('REQUESTED', 'CONFLICT_CHECK', 'DECLINED', 'QUOTED', 'QUOTE_EXPIRED', 'CLIENT_DECLINED', 'ACCEPTED', 'SCHEDULED', 'RESCHEDULE_REQUESTED', 'COMPLETED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_FIRM', 'NO_SHOW', 'DISPUTED');
ALTER TABLE "public"."Booking" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Booking" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::text::"BookingStatus_new");
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "public"."BookingStatus_old";
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';
COMMIT;

