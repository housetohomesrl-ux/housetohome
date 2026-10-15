-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "clientAddress" TEXT,
ADD COLUMN     "clientTaxCode" TEXT,
ADD COLUMN     "clientVatNumber" TEXT,
ADD COLUMN     "quoteDate" TIMESTAMP(3),
ADD COLUMN     "quoteValidUntil" TIMESTAMP(3);
