-- AlterTable
ALTER TABLE "renovation_settings" ADD COLUMN     "laborMarkupPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "materialMarkupPct" DECIMAL(5,2) NOT NULL DEFAULT 0;
