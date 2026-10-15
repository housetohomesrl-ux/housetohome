-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "clientAcconto1Amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "clientAcconto1Pct" DECIMAL(5,2),
ADD COLUMN     "clientAcconto2Amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "clientAcconto2Pct" DECIMAL(5,2),
ADD COLUMN     "clientAcconto3Amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "clientAcconto3Pct" DECIMAL(5,2),
ADD COLUMN     "clientSaldoAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
