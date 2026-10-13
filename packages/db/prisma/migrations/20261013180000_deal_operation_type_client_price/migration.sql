-- CreateEnum
CREATE TYPE "DealOperationType" AS ENUM ('FLIP', 'RISTRUTTURAZIONE_CLIENTE');

-- AlterTable
ALTER TABLE "deals" ADD COLUMN "operationType" "DealOperationType" NOT NULL DEFAULT 'FLIP';

-- AlterTable
ALTER TABLE "cost_line_items" ADD COLUMN "clientPrice" DECIMAL(14,2);
