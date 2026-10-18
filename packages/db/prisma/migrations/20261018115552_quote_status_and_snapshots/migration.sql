-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('BOZZA', 'INVIATO', 'ACCETTATO', 'RIFIUTATO');

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "quoteStatus" "QuoteStatus" NOT NULL DEFAULT 'BOZZA';

-- CreateTable
CREATE TABLE "quote_snapshots" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grandTotal" DECIMAL(14,2) NOT NULL,
    "vatRatePct" DECIMAL(5,2) NOT NULL,
    "items" JSONB NOT NULL,

    CONSTRAINT "quote_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quote_snapshots_dealId_idx" ON "quote_snapshots"("dealId");

-- AddForeignKey
ALTER TABLE "quote_snapshots" ADD CONSTRAINT "quote_snapshots_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
