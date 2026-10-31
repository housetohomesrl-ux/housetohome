-- CreateTable
CREATE TABLE "survey_checklist_entries" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "priceListItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_checklist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "survey_checklist_entries_dealId_idx" ON "survey_checklist_entries"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "survey_checklist_entries_dealId_priceListItemId_key" ON "survey_checklist_entries"("dealId", "priceListItemId");

-- AddForeignKey
ALTER TABLE "survey_checklist_entries" ADD CONSTRAINT "survey_checklist_entries_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_checklist_entries" ADD CONSTRAINT "survey_checklist_entries_priceListItemId_fkey" FOREIGN KEY ("priceListItemId") REFERENCES "price_list_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
