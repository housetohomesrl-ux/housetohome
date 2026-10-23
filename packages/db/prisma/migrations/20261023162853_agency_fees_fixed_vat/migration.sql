-- AlterTable
ALTER TABLE "sale_scenarios" ADD COLUMN     "agencyFeesSellFixed" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "agencyFeesSellVatRatePct" DECIMAL(5,2) NOT NULL DEFAULT 0;
