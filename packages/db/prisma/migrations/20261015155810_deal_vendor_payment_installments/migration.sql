/*
  Warnings:

  - You are about to drop the column `amountPaid` on the `deal_vendor_payments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "deal_vendor_payments" DROP COLUMN "amountPaid",
ADD COLUMN     "acconto1Amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "acconto1Pct" DECIMAL(5,2),
ADD COLUMN     "acconto2Amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "acconto2Pct" DECIMAL(5,2),
ADD COLUMN     "acconto3Amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "acconto3Pct" DECIMAL(5,2),
ADD COLUMN     "saldoAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
