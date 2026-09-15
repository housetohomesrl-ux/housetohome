-- AlterTable
ALTER TABLE "price_list_items" ADD COLUMN     "includeInBusinessPlan" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "includeInPreventivo" BOOLEAN NOT NULL DEFAULT true;
