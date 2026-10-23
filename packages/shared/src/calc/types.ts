// Tipi di input/output del motore di calcolo. Sono intenzionalmente
// disaccoppiati dai modelli Prisma (packages/db) cosicché questo pacchetto
// possa essere importato anche dal frontend (per l'anteprima live dei
// calcoli mentre l'utente compila i form) senza portarsi dietro il client DB.

export type CostCategoryGroup = "ACQUISIZIONE" | "MATERIALI" | "LAVORAZIONI" | "ENTI_ESTERNI" | "ALTRO";

// Forma pura (nessun calcolo qui) del dettaglio per singolo finanziamento
// aziendale mostrato in scheda Risultati — calcolato server-side (vedi
// apps/api/src/lib/companyLoanBreakdown.ts), ma il tipo vive qui perché deve
// essere "nominabile" anche dal frontend attraverso il router tRPC.
export interface CompanyLoanBreakdown {
  id: string;
  name: string;
  rataCost: number;
  poolAvailable: number;
  residualToday: number;
}

export type CostLineItemStatus = "DA_FARE" | "IN_CORSO" | "COMPLETATO";

export interface CostLineItemInput {
  id: string;
  categoryGroup: CostCategoryGroup;
  taxableAmount: number;
  vatRatePct: number;
  /** Porzione dello stesso costo fuori campo IVA (es. pagata in contanti senza fattura): nessuna IVA applicata, ma è comunque un costo reale. */
  nonTaxableAmount?: number;
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
  // Provvigione agenzia vendita in euro fissi, in aggiunta (non alternativa)
  // alla percentuale sopra.
  agencyFeesSellFixed?: number;
  // IVA sulla provvigione agenzia (percentuale+fissa), se fatturata: si
  // somma ai costi di vendita solo se l'IVA sui costi non è recuperabile.
  agencyFeesSellVatRatePct?: number;
  marketingStagingCosts: number;
  closingCosts: number;
}

export interface DealFinancialsInput {
  purchasePrice: number;
  contingencyPct: number;
  // Costo reale (capitale + interessi, la rata intera) dei finanziamenti
  // aziendali sempre attivi (CompanyLoan — mutuo e prestito soci, non legati
  // a un singolo deal), calcolato server-side dalla finestra [data acquisto,
  // + durata cantiere] sul piano di ammortamento vero fornito dalla banca.
  // Si somma ai costi di detenzione, separato dagli interessi dei Loan del
  // deal (quelli restano solo-interessi, qui si conta l'intera rata perché
  // è un costo fisso che l'azienda paga comunque ogni mese.
  externalFinancingCost?: number;
  // Capitale residuo disponibile dal pool dei finanziamenti aziendali: il
  // totale erogato dalla banca (somma di tutte le quote capitale di tutto il
  // piano di ammortamento di Mutuo Fabrizio + Prestito SRL) meno il costo
  // totale progetto di tutti gli ALTRI flip attivi (non chiusi/archiviati)
  // del tenant — calcolato server-side. Usato in Fonti e impieghi come
  // "Fonti: finanziamenti" automatica, così valutando un nuovo flip si vede
  // subito quanto capitale resta dopo aver già impegnato quello sugli altri.
  externalFinancingPrincipal?: number;
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
  /** Somma delle porzioni fuori campo IVA (nonTaxableAmount) delle righe del gruppo. */
  nonTaxableTotal: number;
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
  nonMemoNonTaxableTotal: number;
  nonMemoTotalWithVat: number;
  nonMemoPaidTotal: number;
  nonMemoDueTotal: number;
}

export interface HoldingCostsResult {
  nonLoanMonthlyTotal: number;
  nonLoanTotal: number;
  loanInterestTotal: number;
  // Rata intera (capitale + interessi) dei finanziamenti aziendali sempre
  // attivi nella finestra di questo deal — vedi externalFinancingCost.
  externalFinancingCost: number;
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
  // Quota di loanSources che arriva in automatico dal capitale dei
  // finanziamenti aziendali (vedi externalFinancingPrincipal), già inclusa
  // in loanSources — esposta a parte solo per mostrarla in UI.
  externalFinancingSources: number;
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
    // Credito IVA generato da questa operazione (solo se costsVatRecoverable
    // è attivo): IVA sui costi non ancora compensata dall'IVA sulla vendita.
    vatCredit: number;
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
