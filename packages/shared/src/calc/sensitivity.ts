import { computeDealFinancials } from "./margin.js";
import type { CostLineItemInput, DealFinancialsInput, LoanInput } from "./types.js";

function withSalePriceDelta(input: DealFinancialsInput, deltaPct: number): DealFinancialsInput {
  return {
    ...input,
    saleScenario: {
      ...input.saleScenario,
      estimatedSalePrice: input.saleScenario.estimatedSalePrice * (1 + deltaPct),
    },
  };
}

/** Applica lo sforamento SOLO alle righe di categoria LAVORAZIONI (manodopera/esecuzione), come da specifica. */
function withLavorazioniOverrun(input: DealFinancialsInput, overrunPct: number): DealFinancialsInput {
  const costLineItems: CostLineItemInput[] = input.costLineItems.map((item) =>
    item.categoryGroup === "LAVORAZIONI"
      ? { ...item, taxableAmount: item.taxableAmount * (1 + overrunPct) }
      : item,
  );
  return { ...input, costLineItems };
}

/** Estende la durata di detenzione e, proporzionalmente, la durata dei finanziamenti INTEREST_ONLY/FRENCH. */
function withDurationDelta(input: DealFinancialsInput, deltaMonths: number): DealFinancialsInput {
  const loans: LoanInput[] = input.loans.map((loan) =>
    loan.amortizationType === "MANUAL" ? loan : { ...loan, durationMonths: loan.durationMonths + deltaMonths },
  );
  return {
    ...input,
    loans,
    holdingCosts: { ...input.holdingCosts, durationMonths: input.holdingCosts.durationMonths + deltaMonths },
  };
}

export interface SensitivityVariableResult {
  label: string;
  netProfit: number;
  roi: number;
}

export interface SingleVariableSensitivityResult {
  base: { netProfit: number; roi: number };
  salePriceScenarios: SensitivityVariableResult[];
  lavorazioniOverrunScenarios: SensitivityVariableResult[];
  durationDelayScenarios: SensitivityVariableResult[];
}

/**
 * Analisi di sensitività a singola variabile: ricalcola margine netto e ROI
 * facendo variare, una alla volta:
 *  - prezzo di vendita: −5% / −10% / −15%
 *  - sforamento sulle sole lavorazioni: +10% / +20%
 *  - durata di detenzione: +2 / +4 mesi
 */
export function computeSingleVariableSensitivity(
  input: DealFinancialsInput,
  options?: { salePriceDeltasPct?: number[]; lavorazioniOverrunPct?: number[]; durationDeltaMonths?: number[] },
): SingleVariableSensitivityResult {
  const salePriceDeltas = options?.salePriceDeltasPct ?? [-0.05, -0.1, -0.15];
  const overruns = options?.lavorazioniOverrunPct ?? [0.1, 0.2];
  const durationDeltas = options?.durationDeltaMonths ?? [2, 4];

  const base = computeDealFinancials(input);

  return {
    base: { netProfit: base.sale.netProfit, roi: base.kpis.roi },
    salePriceScenarios: salePriceDeltas.map((delta) => {
      const result = computeDealFinancials(withSalePriceDelta(input, delta));
      return { label: `${delta * 100}%`, netProfit: result.sale.netProfit, roi: result.kpis.roi };
    }),
    lavorazioniOverrunScenarios: overruns.map((overrun) => {
      const result = computeDealFinancials(withLavorazioniOverrun(input, overrun));
      return { label: `+${overrun * 100}%`, netProfit: result.sale.netProfit, roi: result.kpis.roi };
    }),
    durationDelayScenarios: durationDeltas.map((delta) => {
      const result = computeDealFinancials(withDurationDelta(input, delta));
      return { label: `+${delta} mesi`, netProfit: result.sale.netProfit, roi: result.kpis.roi };
    }),
  };
}

export interface DoubleEntrySensitivityMatrix {
  salePriceDeltasPct: number[];
  lavorazioniOverrunPct: number[];
  /** matrix[i][j] = utile netto per salePriceDeltasPct[i] × lavorazioniOverrunPct[j] */
  netProfitMatrix: number[][];
}

/**
 * Tabella di sensitività a doppia entrata: righe = prezzi di vendita
 * ipotizzati (espressi come variazione % rispetto al prezzo base), colonne
 * = % di sforamento sulle sole lavorazioni, celle = utile netto risultante.
 * Generata automaticamente dai dati correnti del deal.
 */
export function computeDoubleEntrySensitivityMatrix(
  input: DealFinancialsInput,
  options?: { salePriceDeltasPct?: number[]; lavorazioniOverrunPct?: number[] },
): DoubleEntrySensitivityMatrix {
  const salePriceDeltasPct = options?.salePriceDeltasPct ?? [-0.15, -0.1, -0.05, 0, 0.05];
  const lavorazioniOverrunPct = options?.lavorazioniOverrunPct ?? [0, 0.1, 0.2, 0.3];

  const netProfitMatrix = salePriceDeltasPct.map((priceDelta) =>
    lavorazioniOverrunPct.map((overrun) => {
      const scenarioInput = withLavorazioniOverrun(withSalePriceDelta(input, priceDelta), overrun);
      return computeDealFinancials(scenarioInput).sale.netProfit;
    }),
  );

  return { salePriceDeltasPct, lavorazioniOverrunPct, netProfitMatrix };
}
