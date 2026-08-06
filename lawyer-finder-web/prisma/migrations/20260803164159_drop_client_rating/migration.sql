/*
  Warnings:

  - You are about to drop the column `clientFeedback` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `clientRating` on the `Booking` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "clientFeedback",
DROP COLUMN "clientRating";
