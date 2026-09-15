-- AlterTable
ALTER TABLE "price_list_items" ADD COLUMN     "referenceQuantity" TEXT,
ADD COLUMN     "specification" TEXT,
ADD COLUMN     "vendorId" TEXT;

-- CreateIndex
CREATE INDEX "price_list_items_vendorId_idx" ON "price_list_items"("vendorId");

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
