// Tipi di input/output del motore di calcolo. Sono intenzionalmente
// disaccoppiati dai modelli Prisma (packages/db) cosicché questo pacchetto
// possa essere importato anche dal frontend (per l'anteprima live dei
// calcoli mentre l'utente compila i form) senza portarsi dietro il client DB.

export type CostCategoryGroup = "ACQUISIZIONE" | "MATERIALI" | "LAVORAZIONI" | "ENTI_ESTERNI" | "ALTRO";

export type CostLineItemStatus = "DA_FARE" | "IN_CORSO" | "COMPLETATO";

export interface CostLineItemInput {
  id: string;
  categoryGroup: CostCategoryGroup;
  taxableAmount: number;
  vatRatePct: number;
  paidAmount: number;
  isMemo: boolean;
  isUnbilled: boolean;
}

export type LoanType = "MUTUO_PONTE" | "PRESTITO_SOCI" | "ALTRO";
export type AmortizationType = "INTEREST_ONLY" | "FRENCH" | "MANUAL";

export interface ManualLoanPaymentInput {
  month: number;
  principalPortion: number;
  interestPortion: number;
}

export interface LoanInput {
  id: string;
  type: LoanType;
  principalAmount: number;
  annualInterestRatePct: number;
  durationMonths: number;
  amortizationType: AmortizationType;
  /** Richiesto e usato solo quando amortizationType === "MANUAL". */
  manualPayments?: ManualLoanPaymentInput[];
}

export interface LoanScheduleMonth {
  month: number;
  principalPortion: number;
  interestPortion: number;
  totalPayment: number;
  remainingPrincipal: number;
}

export interface LoanScheduleResult {
  loanId: string;
  schedule: LoanScheduleMonth[];
  totalInterest: number;
  totalPrincipal: number;
}

export interface PartnerInput {
  id: string;
  contributionAmount: number;
  profitSharePct: number;
}

export interface HoldingCostsConfigInput {
  durationMonths: number;
  monthlyInsurance: number;
  monthlyUtilities: number;
  monthlyPropertyTax: number;
  monthlyCondoFees: number;
  otherMonthlyCosts: number;
}

export type FiscalRegimeType = "SOCIETA_CAPITALI" | "PERSONA_FISICA" | "ALTRO";

export interface FiscalSettingsInput {
  regimeType: FiscalRegimeType;
  saleSubjectToVat: boolean;
  costsVatRecoverable: boolean;
  iresRatePct: number;
  irapRatePct: number;
  capitalGainsTaxRatePct: number;
}

export type SaleScenarioType = "PRUDENTE" | "REALISTICO" | "OTTIMISTICO";

export interface SaleScenarioInput {
  scenario: SaleScenarioType;
  estimatedSalePrice: number;
  vatRatePct: number;
  agencyFeesSellPct: number;
  marketingStagingCosts: number;
  closingCosts: number;
}

export interface DealFinancialsInput {
  purchasePrice: number;
  contingencyPct: number;
  costLineItems: CostLineItemInput[];
  loans: LoanInput[];
  partners: PartnerInput[];
  holdingCosts: HoldingCostsConfigInput;
  fiscalSettings: FiscalSettingsInput;
  saleScenario: SaleScenarioInput;
}

// --- Output --------------------------------------------------------------

export interface CostGroupTotals {
  taxableTotal: number;
  vatTotal: number;
  totalWithVat: number;
  paidTotal: number;
  dueTotal: number;
}

export interface CostAggregation {
  byGroup: Record<CostCategoryGroup, CostGroupTotals>;
  /** Somma di taxableAmount per le sole righe LAVORAZIONI+MATERIALI, base su cui si applica la contingency. */
  contingencyBaseTaxable: number;
  contingencyAmount: number;
  memoTaxableTotal: number;
  unbilledTaxableTotal: number;
  nonMemoTaxableTotal: number;
  nonMemoVatTotal: number;
  nonMemoTotalWithVat: number;
  nonMemoPaidTotal: number;
  nonMemoDueTotal: number;
}

export interface HoldingCostsResult {
  nonLoanMonthlyTotal: number;
  nonLoanTotal: number;
  loanInterestTotal: number;
  total: number;
  loanSchedules: LoanScheduleResult[];
}

export interface TaxResult {
  iresAmount: number;
  irapAmount: number;
  capitalGainsTaxAmount: number;
  totalTax: number;
  /** true se il calcolo è una stima esplicitamente segnalata (IRES/IRAP), non un valore fiscale definitivo. */
  isEstimate: boolean;
}

export interface SourcesAndUsesResult {
  usesTotal: number;
  equitySources: number;
  loanSources: number;
  sourcesTotal: number;
  coverage: number;
  isUndercovered: boolean;
  saleProceeds: number;
  loanPrincipalRepaidAtSale: number;
  netVatSettlement: number;
  remainingUnpaidCosts: number;
  finalNetCashToEquity: number;
}

export interface DealFinancialsResult {
  costs: CostAggregation;
  holding: HoldingCostsResult;
  taxes: TaxResult;
  totals: {
    totalAcquisitionCost: number;
    totalRenovationCost: number;
    totalEntiEsterniCost: number;
    totalAltroCost: number;
    totalProjectCost: number;
  };
  sale: {
    saleVatAmount: number;
    saleCosts: number;
    grossProfitBeforeTax: number;
    netProfit: number;
  };
  kpis: {
    equityInvested: number;
    roi: number;
    marginOnCostPct: number;
    marginOnRevenuePct: number;
    cashOnCash: number;
    cashOnCashAnnualized: number;
    breakevenSalePrice: number;
  };
  sourcesAndUses: SourcesAndUsesResult;
}
