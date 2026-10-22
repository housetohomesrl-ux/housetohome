-- CreateEnum
CREATE TYPE "PurchaseCategoryType" AS ENUM ('PRIMA_CASA', 'SECONDA_CASA');

-- AlterTable
ALTER TABLE "acquisition_details" ADD COLUMN     "purchaseCategory" "PurchaseCategoryType",
ADD COLUMN     "renditaCatastale" DECIMAL(14,2);
