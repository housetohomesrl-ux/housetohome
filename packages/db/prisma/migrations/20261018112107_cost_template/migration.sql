-- CreateTable
CREATE TABLE "cost_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "libraryScope" "DealOperationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_template_items" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "priceListItemId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cost_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cost_templates_tenantId_idx" ON "cost_templates"("tenantId");

-- CreateIndex
CREATE INDEX "cost_template_items_templateId_idx" ON "cost_template_items"("templateId");

-- AddForeignKey
ALTER TABLE "cost_templates" ADD CONSTRAINT "cost_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_template_items" ADD CONSTRAINT "cost_template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "cost_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_template_items" ADD CONSTRAINT "cost_template_items_priceListItemId_fkey" FOREIGN KEY ("priceListItemId") REFERENCES "price_list_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
