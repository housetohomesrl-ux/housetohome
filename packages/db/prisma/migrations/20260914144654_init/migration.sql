-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('VALUTAZIONE', 'ACQUISIZIONE', 'RISTRUTTURAZIONE', 'VENDITA', 'CHIUSO', 'ARCHIVIATO');

-- CreateEnum
CREATE TYPE "FiscalRegimeType" AS ENUM ('SOCIETA_CAPITALI', 'PERSONA_FISICA', 'ALTRO');

-- CreateEnum
CREATE TYPE "CostCategoryGroup" AS ENUM ('ACQUISIZIONE', 'MATERIALI', 'LAVORAZIONI', 'ENTI_ESTERNI', 'ALTRO');

-- CreateEnum
CREATE TYPE "CostLineItemStatus" AS ENUM ('DA_FARE', 'IN_CORSO', 'COMPLETATO');

-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('MUTUO_PONTE', 'PRESTITO_SOCI', 'ALTRO');

-- CreateEnum
CREATE TYPE "AmortizationType" AS ENUM ('INTEREST_ONLY', 'FRENCH', 'MANUAL');

-- CreateEnum
CREATE TYPE "SaleScenarioType" AS ENUM ('PRUDENTE', 'REALISTICO', 'OTTIMISTICO');

-- CreateEnum
CREATE TYPE "NoteSeverity" AS ENUM ('INFO', 'AVVISO', 'CRITICO');

-- CreateEnum
CREATE TYPE "BusinessPlanStatus" AS ENUM ('BOZZA', 'FINALE');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('LOGO', 'QUOTE_FILE', 'EXPORT_PDF', 'EXPORT_DOCX', 'OTHER');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "propertyType" TEXT,
    "status" "DealStatus" NOT NULL DEFAULT 'VALUTAZIONE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acquisition_details" (
    "dealId" TEXT NOT NULL,
    "purchasePrice" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acquisition_details_pkey" PRIMARY KEY ("dealId")
);

-- CreateTable
CREATE TABLE "fiscal_settings" (
    "dealId" TEXT NOT NULL,
    "regimeType" "FiscalRegimeType" NOT NULL DEFAULT 'PERSONA_FISICA',
    "saleSubjectToVat" BOOLEAN NOT NULL DEFAULT false,
    "costsVatRecoverable" BOOLEAN NOT NULL DEFAULT false,
    "iresRatePct" DECIMAL(5,2) NOT NULL DEFAULT 24,
    "irapRatePct" DECIMAL(5,2) NOT NULL DEFAULT 3.9,
    "capitalGainsTaxRatePct" DECIMAL(5,2) NOT NULL DEFAULT 26,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_settings_pkey" PRIMARY KEY ("dealId")
);

-- CreateTable
CREATE TABLE "renovation_settings" (
    "dealId" TEXT NOT NULL,
    "contingencyPct" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "renovation_settings_pkey" PRIMARY KEY ("dealId")
);

-- CreateTable
CREATE TABLE "cost_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "group" "CostCategoryGroup" NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cost_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_line_items" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "taxableAmount" DECIMAL(14,2) NOT NULL,
    "vatRatePct" DECIMAL(5,2) NOT NULL DEFAULT 22,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "CostLineItemStatus" NOT NULL DEFAULT 'DA_FARE',
    "isMemo" BOOLEAN NOT NULL DEFAULT false,
    "isUnbilled" BOOLEAN NOT NULL DEFAULT false,
    "vendorId" TEXT,
    "selectedQuoteId" TEXT,
    "priceListItemId" TEXT,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "costLineItemId" TEXT NOT NULL,
    "vendorId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "fileUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "specialty" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LoanType" NOT NULL DEFAULT 'MUTUO_PONTE',
    "principalAmount" DECIMAL(14,2) NOT NULL,
    "annualInterestRatePct" DECIMAL(6,3) NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "amortizationType" "AmortizationType" NOT NULL DEFAULT 'INTEREST_ONLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_payments" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "principalPortion" DECIMAL(14,2) NOT NULL,
    "interestPortion" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "loan_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contributionAmount" DECIMAL(14,2) NOT NULL,
    "profitSharePct" DECIMAL(5,2) NOT NULL,
    "linkedUserId" TEXT,
    "notes" TEXT,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holding_costs_config" (
    "dealId" TEXT NOT NULL,
    "durationMonths" INTEGER NOT NULL DEFAULT 6,
    "monthlyInsurance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "monthlyUtilities" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "monthlyPropertyTax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "monthlyCondoFees" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otherMonthlyCosts" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holding_costs_config_pkey" PRIMARY KEY ("dealId")
);

-- CreateTable
CREATE TABLE "sale_scenarios" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "scenario" "SaleScenarioType" NOT NULL,
    "estimatedSalePrice" DECIMAL(14,2) NOT NULL,
    "vatRatePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "agencyFeesSellPct" DECIMAL(5,2) NOT NULL DEFAULT 3,
    "marketingStagingCosts" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "closingCosts" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "text" TEXT NOT NULL,
    "severity" "NoteSeverity" NOT NULL DEFAULT 'INFO',
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_profiles" (
    "tenantId" TEXT NOT NULL,
    "companyName" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "teamBio" TEXT,
    "website" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "business_plan_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "layoutConfig" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "business_plan_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_plans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "executiveSummary" TEXT,
    "investorProfileText" TEXT,
    "status" "BusinessPlanStatus" NOT NULL DEFAULT 'BOZZA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_plan_deals" (
    "businessPlanId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,

    CONSTRAINT "business_plan_deals_pkey" PRIMARY KEY ("businessPlanId","dealId")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dealId" TEXT,
    "type" "AttachmentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "deals_tenantId_status_idx" ON "deals"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cost_categories_tenantId_idx" ON "cost_categories"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_line_items_selectedQuoteId_key" ON "cost_line_items"("selectedQuoteId");

-- CreateIndex
CREATE INDEX "cost_line_items_dealId_idx" ON "cost_line_items"("dealId");

-- CreateIndex
CREATE INDEX "cost_line_items_categoryId_idx" ON "cost_line_items"("categoryId");

-- CreateIndex
CREATE INDEX "quotes_costLineItemId_idx" ON "quotes"("costLineItemId");

-- CreateIndex
CREATE INDEX "vendors_tenantId_idx" ON "vendors"("tenantId");

-- CreateIndex
CREATE INDEX "price_list_items_tenantId_idx" ON "price_list_items"("tenantId");

-- CreateIndex
CREATE INDEX "loans_dealId_idx" ON "loans"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_payments_loanId_month_key" ON "loan_payments"("loanId", "month");

-- CreateIndex
CREATE INDEX "partners_dealId_idx" ON "partners"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_scenarios_dealId_scenario_key" ON "sale_scenarios"("dealId", "scenario");

-- CreateIndex
CREATE INDEX "notes_dealId_isResolved_idx" ON "notes"("dealId", "isResolved");

-- CreateIndex
CREATE INDEX "business_plan_templates_tenantId_idx" ON "business_plan_templates"("tenantId");

-- CreateIndex
CREATE INDEX "business_plans_tenantId_idx" ON "business_plans"("tenantId");

-- CreateIndex
CREATE INDEX "attachments_tenantId_idx" ON "attachments"("tenantId");

-- CreateIndex
CREATE INDEX "attachments_dealId_idx" ON "attachments"("dealId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acquisition_details" ADD CONSTRAINT "acquisition_details_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_settings" ADD CONSTRAINT "fiscal_settings_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renovation_settings" ADD CONSTRAINT "renovation_settings_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_categories" ADD CONSTRAINT "cost_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_line_items" ADD CONSTRAINT "cost_line_items_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_line_items" ADD CONSTRAINT "cost_line_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "cost_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_line_items" ADD CONSTRAINT "cost_line_items_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_line_items" ADD CONSTRAINT "cost_line_items_selectedQuoteId_fkey" FOREIGN KEY ("selectedQuoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_line_items" ADD CONSTRAINT "cost_line_items_priceListItemId_fkey" FOREIGN KEY ("priceListItemId") REFERENCES "price_list_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_costLineItemId_fkey" FOREIGN KEY ("costLineItemId") REFERENCES "cost_line_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "cost_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holding_costs_config" ADD CONSTRAINT "holding_costs_config_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_scenarios" ADD CONSTRAINT "sale_scenarios_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_plan_templates" ADD CONSTRAINT "business_plan_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_plans" ADD CONSTRAINT "business_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_plans" ADD CONSTRAINT "business_plans_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "business_plan_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_plan_deals" ADD CONSTRAINT "business_plan_deals_businessPlanId_fkey" FOREIGN KEY ("businessPlanId") REFERENCES "business_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_plan_deals" ADD CONSTRAINT "business_plan_deals_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
