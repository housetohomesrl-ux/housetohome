-- CreateTable
CREATE TABLE "deal_vendor_payments" (
    "dealId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_vendor_payments_pkey" PRIMARY KEY ("dealId","vendorId")
);

-- AddForeignKey
ALTER TABLE "deal_vendor_payments" ADD CONSTRAINT "deal_vendor_payments_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_vendor_payments" ADD CONSTRAINT "deal_vendor_payments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
