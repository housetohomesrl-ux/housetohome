import Decimal from "decimal.js";
import { money, sumMoney, toMoneyNumber, toRatioNumber, ZERO } from "./money.js";
import { computeVat } from "./vat.js";
import { relevantGroupTotal } from "./costs.js";
import { computeDealFinancials } from "./margin.js";
import { remainingPrincipalAtMonth } from "./loan.js";
import { withDurationDelta, withSalePriceDelta } from "./sensitivity.js";
import type { CostCategoryGroup, DealFinancialsInput, DealFinancialsResult } from "./types.js";

// ---------------------------------------------------------------------------
// Business plan di un'operazione: indicatori per investitori, cash flow
// mensile e scenari di rischio, calcolati SEMPRE a partire dagli stessi input
// del motore di calcolo (computeDealFinancials), così che ogni numero del
// business plan coincida con quelli della tab Risultati.
// ---------------------------------------------------------------------------

export interface BusinessPlanKpis {
  salePrice: number;
  saleCosts: number;
  totalProjectCost: number;
  /** Margine lordo = prezzo di vendita − costi di vendita − costo totale operazione (pre-imposte). */
  grossMargin: number;
  taxes: number;
  /** Margine netto = margine lordo − imposte. */
  netMargin: number;
  equityInvested: number;
  /** ROI = margine netto / costo totale operazione. */
  roi: number;
  /** ROE = margine netto / capitale proprio investito (null se il capitale proprio è zero). */
  roe: number | null;
  /** Margine % sul prezzo di vendita. */
  marginOnRevenue: number;
  durationMonths: number;
  /** Rendimento annualizzato = (1 + ROI)^(12 / mesi) − 1. */
  annualizedRoi: number;
  /** ROE annualizzato = (1 + ROE)^(12 / mesi) − 1 (null se il capitale proprio è zero). */
  annualizedRoe: number | null;
}

export type BusinessPlanScenarioKey = "PESSIMISTICO" | "BASE" | "OTTIMISTICO";

export interface BusinessPlanScenarioDefinition {
  key: BusinessPlanScenarioKey;
  label: string;
  /** Variazione del prezzo di vendita, come frazione (−0.10 = −10%). */
  salePriceDeltaPct: number;
  /** Sforamento sui costi lavori (Lavorazioni + Materiali), come frazione (0.15 = +15%). */
  renovationOverrunPct: number;
  /** Ritardo in mesi su durata operazione e finanziamenti. */
  delayMonths: number;
}

export interface BusinessPlanScenarioResult extends BusinessPlanScenarioDefinition {
  kpis: BusinessPlanKpis;
}

export interface BusinessPlanStressTest {
  label: string;
  netMargin: number;
  roi: number;
  /** Differenza di margine netto rispetto allo scenario base. */
  deltaVsBase: number;
}

export interface CashFlowMonth {
  month: number;
  /** Prezzo + costi di acquisizione (mese 0). */
  acquisition: number;
  /** Lavori (Lavorazioni + Materiali + imprevisti) + Enti esterni + Altro, ripartiti sui mesi di cantiere. */
  renovation: number;
  /** Costi fissi di detenzione (assicurazione, utenze, IMU, condominio, altri). */
  holding: number;
  loanDisbursement: number;
  loanInterest: number;
  loanPrincipal: number;
  /** Incasso vendita al netto dei costi di vendita (mese di vendita). */
  saleNet: number;
  taxes: number;
  /** Flusso netto del mese (escluso il capitale proprio versato). */
  net: number;
  /** Flusso cumulato: il minimo è il fabbisogno di capitale proprio. */
  cumulative: number;
}

export interface CashFlowResult {
  renovationMonths: number;
  saleMonth: number;
  months: CashFlowMonth[];
  /** Fabbisogno massimo di cassa (valore positivo) da coprire con capitale proprio. */
  peakFundingNeed: number;
  peakFundingMonth: number;
  /** Capitale proprio − fabbisogno massimo: se negativo il capitale non basta. */
  equityHeadroom: number;
}

export interface BusinessPlanResult {
  financials: DealFinancialsResult;
  kpis: BusinessPlanKpis;
  scenarios: BusinessPlanScenarioResult[];
  stressTests: BusinessPlanStressTest[];
  cashFlow: CashFlowResult;
}

/** Scenari standard del metodo House to Home (prezzo −10% / 0 / +5%, lavori +15%, tempi +3 mesi). */
export const DEFAULT_BUSINESS_PLAN_SCENARIOS: BusinessPlanScenarioDefinition[] = [
  { key: "PESSIMISTICO", label: "Pessimistico", salePriceDeltaPct: -0.1, renovationOverrunPct: 0.15, delayMonths: 3 },
  { key: "BASE", label: "Base", salePriceDeltaPct: 0, renovationOverrunPct: 0, delayMonths: 0 },
  { key: "OTTIMISTICO", label: "Ottimistico", salePriceDeltaPct: 0.05, renovationOverrunPct: 0, delayMonths: 0 },
];

const RENOVATION_GROUPS: CostCategoryGroup[] = ["LAVORAZIONI", "MATERIALI"];

/** Applica lo sforamento a tutti i costi lavori (Lavorazioni + Materiali): la contingency segue di conseguenza. */
export function withRenovationOverrun(input: DealFinancialsInput, overrunPct: number): DealFinancialsInput {
  return {
    ...input,
    costLineItems: input.costLineItems.map((item) =>
      RENOVATION_GROUPS.includes(item.categoryGroup)
        ? { ...item, taxableAmount: item.taxableAmount * (1 + overrunPct) }
        : item,
    ),
  };
}

function annualize(ratio: Decimal, months: number): Decimal {
  if (months <= 0) return ZERO;
  if (ratio.lessThanOrEqualTo(-1)) return new Decimal(-1);
  return ratio.plus(1).pow(new Decimal(12).dividedBy(months)).minus(1);
}

function kpisFrom(input: DealFinancialsInput, result: DealFinancialsResult): BusinessPlanKpis {
  const months = input.holdingCosts.durationMonths;
  const netMargin = money(result.sale.netProfit);
  const equity = money(result.kpis.equityInvested);
  const roi = money(result.kpis.roi);
  const roe = equity.isZero() ? null : netMargin.dividedBy(equity);
  return {
    salePrice: input.saleScenario.estimatedSalePrice,
    saleCosts: result.sale.saleCosts,
    totalProjectCost: result.totals.totalProjectCost,
    grossMargin: result.sale.grossProfitBeforeTax,
    taxes: result.taxes.totalTax,
    netMargin: result.sale.netProfit,
    equityInvested: result.kpis.equityInvested,
    roi: result.kpis.roi,
    roe: roe ? toRatioNumber(roe) : null,
    marginOnRevenue: toRatioNumber(money(result.kpis.marginOnRevenuePct).dividedBy(100)),
    durationMonths: months,
    annualizedRoi: toRatioNumber(annualize(roi, months)),
    annualizedRoe: roe ? toRatioNumber(annualize(roe, months)) : null,
  };
}

function applyScenario(input: DealFinancialsInput, def: BusinessPlanScenarioDefinition): DealFinancialsInput {
  let scenarioInput = input;
  if (def.salePriceDeltaPct !== 0) scenarioInput = withSalePriceDelta(scenarioInput, def.salePriceDeltaPct);
  if (def.renovationOverrunPct !== 0) scenarioInput = withRenovationOverrun(scenarioInput, def.renovationOverrunPct);
  if (def.delayMonths !== 0) scenarioInput = withDurationDelta(scenarioInput, def.delayMonths);
  return scenarioInput;
}

/** Ripartisce un importo in n quote uguali; l'arrotondamento residuo va sull'ultima quota. */
function splitEvenly(total: Decimal, n: number): Decimal[] {
  if (n <= 1) return [total];
  const share = total.dividedBy(n).toDecimalPlaces(2);
  const parts = Array.from({ length: n }, () => share);
  parts[n - 1] = total.minus(share.times(n - 1));
  return parts;
}

/**
 * Cash flow mensile dell'operazione (punto di vista della società, escluso il
 * capitale proprio versato, così che il minimo del cumulato sia il fabbisogno
 * di capitale proprio):
 *
 *   mese 0:   − (prezzo + costi di acquisizione) + erogazione finanziamenti
 *   mesi 1..C − lavori + enti esterni + altro, in quote uguali (C = mesi di cantiere)
 *   mesi 1..D − costi fissi di detenzione mensili
 *             − rate dei finanziamenti (quota interessi + quota capitale) fino al mese D−1
 *   mese D:   + prezzo di vendita − costi di vendita − imposte
 *             − capitale residuo dei finanziamenti − interessi residui
 *
 * L'IVA sulla vendita è esclusa (partita di giro). Per costruzione la somma dei
 * flussi coincide con il margine netto calcolato da computeDealFinancials.
 */
export function computeMonthlyCashFlow(
  input: DealFinancialsInput,
  result: DealFinancialsResult,
  options?: { renovationMonths?: number },
): CashFlowResult {
  const durationMonths = Math.max(0, Math.floor(input.holdingCosts.durationMonths));
  const saleMonth = durationMonths;
  const defaultRenovationMonths = Math.max(1, durationMonths - 2);
  const renovationMonths =
    durationMonths === 0
      ? 0
      : Math.min(Math.max(1, Math.floor(options?.renovationMonths ?? defaultRenovationMonths)), durationMonths);

  const recoverable = input.fiscalSettings.costsVatRecoverable;
  const byGroup = result.costs.byGroup;
  const acquisitionTotal = money(input.purchasePrice).plus(relevantGroupTotal(byGroup.ACQUISIZIONE, recoverable));
  const renovationTotal = money(result.totals.totalRenovationCost)
    .plus(result.totals.totalEntiEsterniCost)
    .plus(result.totals.totalAltroCost);
  const renovationParts = renovationMonths === 0 ? [] : splitEvenly(renovationTotal, renovationMonths);

  const months: CashFlowMonth[] = [];
  for (let m = 0; m <= saleMonth; m++) {
    months.push({
      month: m,
      acquisition: 0,
      renovation: 0,
      holding: 0,
      loanDisbursement: 0,
      loanInterest: 0,
      loanPrincipal: 0,
      saleNet: 0,
      taxes: 0,
      net: 0,
      cumulative: 0,
    });
  }
  const at = (m: number) => months[m]!;

  at(0).acquisition = toMoneyNumber(acquisitionTotal);
  at(0).loanDisbursement = toMoneyNumber(sumMoney(input.loans.map((l) => l.principalAmount)));
  if (durationMonths === 0) {
    at(0).renovation = toMoneyNumber(renovationTotal);
  }
  renovationParts.forEach((part, i) => {
    at(i + 1).renovation = toMoneyNumber(part);
  });
  for (let m = 1; m <= durationMonths; m++) {
    at(m).holding = result.holding.nonLoanMonthlyTotal;
  }

  for (const schedule of result.holding.loanSchedules) {
    let interestAfterSale = ZERO;
    for (const row of schedule.schedule) {
      if (row.month < saleMonth) {
        at(row.month).loanInterest = toMoneyNumber(money(at(row.month).loanInterest).plus(row.interestPortion));
        at(row.month).loanPrincipal = toMoneyNumber(money(at(row.month).loanPrincipal).plus(row.principalPortion));
      } else {
        interestAfterSale = interestAfterSale.plus(row.interestPortion);
      }
    }
    const residual = saleMonth === 0 ? schedule.totalPrincipal : remainingPrincipalAtMonth(schedule, saleMonth - 1);
    at(saleMonth).loanInterest = toMoneyNumber(money(at(saleMonth).loanInterest).plus(interestAfterSale));
    at(saleMonth).loanPrincipal = toMoneyNumber(money(at(saleMonth).loanPrincipal).plus(residual));
  }

  at(saleMonth).saleNet = toMoneyNumber(money(input.saleScenario.estimatedSalePrice).minus(result.sale.saleCosts));
  at(saleMonth).taxes = result.taxes.totalTax;

  let cumulative = ZERO;
  let peak = ZERO;
  let peakMonth = 0;
  for (const row of months) {
    const net = money(row.loanDisbursement)
      .plus(row.saleNet)
      .minus(row.acquisition)
      .minus(row.renovation)
      .minus(row.holding)
      .minus(row.loanInterest)
      .minus(row.loanPrincipal)
      .minus(row.taxes);
    cumulative = cumulative.plus(net);
    row.net = toMoneyNumber(net);
    row.cumulative = toMoneyNumber(cumulative);
    if (cumulative.lessThan(peak)) {
      peak = cumulative;
      peakMonth = row.month;
    }
  }

  const peakFundingNeed = peak.negated();
  return {
    renovationMonths,
    saleMonth,
    months,
    peakFundingNeed: toMoneyNumber(peakFundingNeed),
    peakFundingMonth: peakMonth,
    equityHeadroom: toMoneyNumber(money(result.kpis.equityInvested).minus(peakFundingNeed)),
  };
}

/**
 * Business plan completo di un'operazione:
 *  - indicatori per investitori (margine lordo/netto, ROI, ROE, rendimento annualizzato)
 *  - scenari pessimistico / base / ottimistico combinati
 *  - stress test a singola variabile (prezzo, costi lavori, tempi)
 *  - cash flow mensile e fabbisogno massimo di capitale proprio
 */
export function computeBusinessPlan(
  input: DealFinancialsInput,
  options?: { renovationMonths?: number; scenarios?: BusinessPlanScenarioDefinition[] },
): BusinessPlanResult {
  const financials = computeDealFinancials(input);
  const kpis = kpisFrom(input, financials);
  const definitions = options?.scenarios ?? DEFAULT_BUSINESS_PLAN_SCENARIOS;

  const scenarios = definitions.map((def) => {
    const scenarioInput = applyScenario(input, def);
    return { ...def, kpis: kpisFrom(scenarioInput, computeDealFinancials(scenarioInput)) };
  });

  const pessimistic = definitions.find((d) => d.key === "PESSIMISTICO") ?? DEFAULT_BUSINESS_PLAN_SCENARIOS[0]!;
  const stressDefinitions: Array<{ label: string; def: Partial<BusinessPlanScenarioDefinition> }> = [
    { label: `Prezzo di vendita ${Math.round(pessimistic.salePriceDeltaPct * 100)}%`, def: { salePriceDeltaPct: pessimistic.salePriceDeltaPct } },
    { label: `Costi lavori +${Math.round(pessimistic.renovationOverrunPct * 100)}%`, def: { renovationOverrunPct: pessimistic.renovationOverrunPct } },
    { label: `Tempi +${pessimistic.delayMonths} mesi`, def: { delayMonths: pessimistic.delayMonths } },
  ];
  const stressTests = stressDefinitions.map(({ label, def }) => {
    const scenarioInput = applyScenario(input, {
      key: "BASE",
      label,
      salePriceDeltaPct: def.salePriceDeltaPct ?? 0,
      renovationOverrunPct: def.renovationOverrunPct ?? 0,
      delayMonths: def.delayMonths ?? 0,
    });
    const r = computeDealFinancials(scenarioInput);
    return {
      label,
      netMargin: r.sale.netProfit,
      roi: r.kpis.roi,
      deltaVsBase: toMoneyNumber(money(r.sale.netProfit).minus(financials.sale.netProfit)),
    };
  });

  return {
    financials,
    kpis,
    scenarios,
    stressTests,
    cashFlow: computeMonthlyCashFlow(input, financials, { renovationMonths: options?.renovationMonths }),
  };
}

// ---------------------------------------------------------------------------
// Piano lavori: sintesi del preventivo del deal per il business plan
// ---------------------------------------------------------------------------

export interface PreventivoLineInput {
  id: string;
  categoryGroup: CostCategoryGroup;
  categoryName: string;
  description: string;
  taxableAmount: number;
  vatRatePct: number;
  isMemo: boolean;
  isUnbilled: boolean;
  vendorName?: string | null;
  /** true se la riga è stata creata da una voce della Libreria prezzi. */
  fromPriceList: boolean;
  /** Flag "Aggiungi a business plan" della voce di libreria collegata. */
  includeInBusinessPlan: boolean;
}

export interface PreventivoCategorySummary {
  group: CostCategoryGroup;
  categoryName: string;
  lineCount: number;
  taxable: number;
  vat: number;
  total: number;
}

export interface PreventivoLineSummary {
  id: string;
  group: CostCategoryGroup;
  categoryName: string;
  description: string;
  vendorName: string | null;
  taxable: number;
  vatRatePct: number;
  total: number;
}

export interface PreventivoSummary {
  /** Categorie dei gruppi lavori (Lavorazioni, Materiali, Enti esterni, Altro); l'acquisizione è a parte. */
  categories: PreventivoCategorySummary[];
  contingencyPct: number;
  contingencyAmount: number;
  taxable: number;
  vat: number;
  /** Totale lavori IVA inclusa, imprevisti compresi (imprevisti senza IVA, come nel motore di calcolo). */
  total: number;
  /** Voci di libreria marcate "Aggiungi a business plan", mostrate in dettaglio. */
  highlightedLines: PreventivoLineSummary[];
  /** Voci senza importo: "DA QUOTARE". */
  toQuoteLines: PreventivoLineSummary[];
  lineCount: number;
  /** Quota dell'imponibile lavori che proviene dalla Libreria prezzi (0..1). */
  priceListCoverage: number;
  unbilledTaxable: number;
}

const WORKS_GROUPS: CostCategoryGroup[] = ["LAVORAZIONI", "MATERIALI", "ENTI_ESTERNI", "ALTRO"];

export function summarizePreventivo(lines: PreventivoLineInput[], contingencyPct: number): PreventivoSummary {
  const works = lines.filter((l) => WORKS_GROUPS.includes(l.categoryGroup) && !l.isMemo);
  const toLine = (l: PreventivoLineInput): PreventivoLineSummary => {
    const { vatAmount } = computeVat(money(l.taxableAmount), l.vatRatePct);
    return {
      id: l.id,
      group: l.categoryGroup,
      categoryName: l.categoryName,
      description: l.description,
      vendorName: l.vendorName ?? null,
      taxable: l.taxableAmount,
      vatRatePct: l.vatRatePct,
      total: toMoneyNumber(money(l.taxableAmount).plus(vatAmount)),
    };
  };

  const categoryMap = new Map<string, { group: CostCategoryGroup; categoryName: string; lines: PreventivoLineInput[] }>();
  for (const line of works) {
    const key = `${line.categoryGroup}::${line.categoryName}`;
    const entry = categoryMap.get(key) ?? { group: line.categoryGroup, categoryName: line.categoryName, lines: [] };
    entry.lines.push(line);
    categoryMap.set(key, entry);
  }
  const categories = [...categoryMap.values()]
    .sort((a, b) => WORKS_GROUPS.indexOf(a.group) - WORKS_GROUPS.indexOf(b.group))
    .map(({ group, categoryName, lines: catLines }) => {
      const taxable = sumMoney(catLines.map((l) => l.taxableAmount));
      const vat = sumMoney(catLines.map((l) => computeVat(money(l.taxableAmount), l.vatRatePct).vatAmount));
      return {
        group,
        categoryName,
        lineCount: catLines.length,
        taxable: toMoneyNumber(taxable),
        vat: toMoneyNumber(vat),
        total: toMoneyNumber(taxable.plus(vat)),
      };
    });

  const taxable = sumMoney(works.map((l) => l.taxableAmount));
  const vat = sumMoney(works.map((l) => computeVat(money(l.taxableAmount), l.vatRatePct).vatAmount));
  const contingencyBase = sumMoney(
    works.filter((l) => RENOVATION_GROUPS.includes(l.categoryGroup)).map((l) => l.taxableAmount),
  );
  const contingencyAmount = contingencyBase.times(contingencyPct).dividedBy(100);
  const fromPriceListTaxable = sumMoney(works.filter((l) => l.fromPriceList).map((l) => l.taxableAmount));

  return {
    categories,
    contingencyPct,
    contingencyAmount: toMoneyNumber(contingencyAmount),
    taxable: toMoneyNumber(taxable),
    vat: toMoneyNumber(vat),
    total: toMoneyNumber(taxable.plus(vat).plus(contingencyAmount)),
    highlightedLines: works.filter((l) => l.includeInBusinessPlan).map(toLine),
    toQuoteLines: lines.filter((l) => !l.isMemo && l.taxableAmount === 0).map(toLine),
    lineCount: works.length,
    priceListCoverage: taxable.isZero() ? 0 : toRatioNumber(fromPriceListTaxable.dividedBy(taxable)),
    unbilledTaxable: toMoneyNumber(sumMoney(works.filter((l) => l.isUnbilled).map((l) => l.taxableAmount))),
  };
}
