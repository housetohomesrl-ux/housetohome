-- AlterTable
ALTER TABLE "cost_line_items" ADD COLUMN     "nonTaxableAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- Data: rinomina la categoria di sistema esistente invece di crearne una nuova duplicata
UPDATE "cost_categories" SET "name" = 'Agenzia' WHERE "tenantId" IS NULL AND "name" = 'Commissioni agenzia (acquisto)';
