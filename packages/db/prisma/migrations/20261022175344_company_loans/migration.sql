-- AlterTable
ALTER TABLE "acquisition_details" ADD COLUMN     "purchaseDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "company_loans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_loan_payments" (
    "id" TEXT NOT NULL,
    "companyLoanId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "principalPortion" DECIMAL(14,2) NOT NULL,
    "interestPortion" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "company_loan_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_loans_tenantId_idx" ON "company_loans"("tenantId");

-- CreateIndex
CREATE INDEX "company_loan_payments_companyLoanId_dueDate_idx" ON "company_loan_payments"("companyLoanId", "dueDate");

-- AddForeignKey
ALTER TABLE "company_loans" ADD CONSTRAINT "company_loans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_loan_payments" ADD CONSTRAINT "company_loan_payments_companyLoanId_fkey" FOREIGN KEY ("companyLoanId") REFERENCES "company_loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
