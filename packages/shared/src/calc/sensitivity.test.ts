import { describe, expect, it } from "vitest";
import { computeDoubleEntrySensitivityMatrix, computeSingleVariableSensitivity } from "./sensitivity.js";
import type { DealFinancialsInput } from "./types.js";

const baseInput: DealFinancialsInput = {
  purchasePrice: 100000,
  contingencyPct: 10,
  costLineItems: [
    { id: "c1", categoryGroup: "ACQUISIZIONE", taxableAmount: 5000, vatRatePct: 22, paidAmount: 0, isMemo: false, isUnbilled: false },
    { id: "c2", categoryGroup: "LAVORAZIONI", taxableAmount: 20000, vatRatePct: 10, paidAmount: 0, isMemo: false, isUnbilled: false },
    { id: "c3", categoryGroup: "MATERIALI", taxableAmount: 10000, vatRatePct: 22, paidAmount: 0, isMemo: false, isUnbilled: false },
  ],
  loans: [],
  partners: [{ id: "P1", contributionAmount: 100000, profitSharePct: 100 }],
  holdingCosts: {
    durationMonths: 6,
    monthlyInsurance: 50,
    monthlyUtilities: 50,
    monthlyPropertyTax: 80,
    monthlyCondoFees: 40,
    otherMonthlyCosts: 0,
  },
  fiscalSettings: {
    regimeType: "ALTRO",
    saleSubjectToVat: false,
    costsVatRecoverable: false,
    iresRatePct: 24,
    irapRatePct: 3.9,
    capitalGainsTaxRatePct: 26,
  },
  saleScenario: {
    scenario: "REALISTICO",
    estimatedSalePrice: 200000,
    vatRatePct: 0,
    agencyFeesSellPct: 3,
    marketingStagingCosts: 1500,
    closingCosts: 500,
  },
};

describe("computeSingleVariableSensitivity", () => {
  const result = computeSingleVariableSensitivity(baseInput);

  it("un prezzo di vendita più basso riduce l'utile netto rispetto al base case", () => {
    for (const scenario of result.salePriceScenarios) {
      expect(scenario.netProfit).toBeLessThan(result.base.netProfit);
    }
    // -15% peggiora di più di -5%
    expect(result.salePriceScenarios[2]!.netProfit).toBeLessThan(result.salePriceScenarios[0]!.netProfit);
  });

  it("uno sforamento maggiore sulle lavorazioni riduce ulteriormente l'utile netto", () => {
    expect(result.lavorazioniOverrunScenarios[1]!.netProfit).toBeLessThan(result.lavorazioniOverrunScenarios[0]!.netProfit);
    expect(result.lavorazioniOverrunScenarios[0]!.netProfit).toBeLessThan(result.base.netProfit);
  });

  it("un ritardo maggiore (più mesi di detenzione) riduce l'utile netto", () => {
    expect(result.durationDelayScenarios[1]!.netProfit).toBeLessThan(result.durationDelayScenarios[0]!.netProfit);
    expect(result.durationDelayScenarios[0]!.netProfit).toBeLessThan(result.base.netProfit);
  });
});

describe("computeDoubleEntrySensitivityMatrix", () => {
  it("genera una matrice con le dimensioni attese e valori monotoni", () => {
    const matrix = computeDoubleEntrySensitivityMatrix(baseInput, {
      salePriceDeltasPct: [-0.1, 0, 0.1],
      lavorazioniOverrunPct: [0, 0.2],
    });
    expect(matrix.netProfitMatrix).toHaveLength(3);
    expect(matrix.netProfitMatrix[0]).toHaveLength(2);

    // a parità di sforamento, prezzo più alto => utile più alto
    expect(matrix.netProfitMatrix[2]![0]!).toBeGreaterThan(matrix.netProfitMatrix[0]![0]!);
    // a parità di prezzo, sforamento maggiore => utile più basso
    expect(matrix.netProfitMatrix[1]![1]!).toBeLessThan(matrix.netProfitMatrix[1]![0]!);
  });
});
