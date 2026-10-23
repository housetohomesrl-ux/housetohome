/*
  Warnings:

  - You are about to drop the column `isLuxuryProperty` on the `acquisition_details` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "acquisition_details" DROP COLUMN "isLuxuryProperty",
ADD COLUMN     "categoriaCatastale" TEXT;
