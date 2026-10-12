import { describe, expect, it } from "vitest";
import { computeBusinessPlan, summarizePreventivo } from "./businessPlan.js";
import type { PreventivoLineInput } from "./businessPlan.js";
import type { DealFinancialsInput } from "./types.js";

// Stesso scenario verificato a mano in margin.test.ts: costo totale 149020,
// margine lordo 42980, imposte 16380, utile netto 26600.
const baseInput: DealFinancialsInput = {
  purchasePrice: 100000,
  contingencyPct: 10,
  costLineItems: [
    { id: "c1", categoryGroup: "ACQUISIZIONE", taxableAmount: 5000, vatRatePct: 22, paidAmount: 0, isMemo: false, isUnbilled: false },
    { id: "c2", categoryGroup: "LAVORAZIONI", taxableAmount: 20000, vatRatePct: 10, paidAmount: 0, isMemo: false, isUnbilled: false },
    { id: "c3", categoryGroup: "MATERIALI", taxableAmount: 10000, vatRatePct: 22, paidAmount: 0, isMemo: false, isUnbilled: false },
    { id: "c4", categoryGroup: "ENTI_ESTERNI", taxableAmount: 2000, vatRatePct: 0, paidAmount: 0, isMemo: false, isUnbilled: false },
  ],
  loans: [
    {
      id: "L1",
      type: "MUTUO_PONTE",
      principalAmount: 80000,
      annualInterestRatePct: 6,
      durationMonths: 6,
      amortizationType: "INTEREST_ONLY",
    },
  ],
  partners: [{ id: "P1", contributionAmount: 60000, profitSharePct: 100 }],
  holdingCosts: {
    durationMonths: 6,
    monthlyInsurance: 50,
    monthlyUtilities: 50,
    monthlyPropertyTax: 80,
    monthlyCondoFees: 40,
    otherMonthlyCosts: 0,
  },
  fiscalSettings: {
    regimeType: "PERSONA_FISICA",
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

describe("computeBusinessPlan - indicatori", () => {
  const plan = computeBusinessPlan(baseInput);

  it("riprende margini e costi dal motore di calcolo", () => {
    expect(plan.kpis.totalProjectCost).toBe(149020);
    expect(plan.kpis.grossMargin).toBe(42980);
    expect(plan.kpis.taxes).toBe(16380);
    expect(plan.kpis.netMargin).toBe(26600);
    expect(plan.kpis.marginOnRevenue).toBe(0.133);
  });

  it("ROI, ROE e rendimenti annualizzati composti", () => {
    expect(plan.kpis.roi).toBeCloseTo(26600 / 149020, 4);
    // ROE = 26600 / 60000
    expect(plan.kpis.roe).toBeCloseTo(0.4433, 4);
    // (1 + ROI)^(12/6) − 1
    expect(plan.kpis.annualizedRoi).toBeCloseTo((1 + 26600 / 149020) ** 2 - 1, 4);
    expect(plan.kpis.annualizedRoe).toBeCloseTo((1 + 26600 / 60000) ** 2 - 1, 4);
  });

  it("ROE nullo senza capitale proprio", () => {
    const noEquity = computeBusinessPlan({ ...baseInput, partners: [] });
    expect(noEquity.kpis.roe).toBeNull();
    expect(noEquity.kpis.annualizedRoe).toBeNull();
  });
});

describe("computeBusinessPlan - scenari e stress test", () => {
  const plan = computeBusinessPlan(baseInput);
  const byKey = Object.fromEntries(plan.scenarios.map((s) => [s.key, s]));

  it("scenario base = indicatori principali", () => {
    expect(byKey.BASE!.kpis.netMargin).toBe(26600);
  });

  it("pessimistico: prezzo −10%, lavori +15%, tempi +3 mesi", () => {
    // Vendita 180000; LAV 23000 (+10% IVA = 25300), MAT 11500 (+22% = 14030), imprevisti 10% di 34500 = 3450
    // Detenzione 9 mesi: 220×9 = 1980 + interessi 400×9 = 3600
    // Costo totale: 106100 + 42780 + 2000 + 5580 = 156460
    const k = byKey.PESSIMISTICO!.kpis;
    expect(k.totalProjectCost).toBe(156460);
    // Margine lordo: 180000 − 7400 − 156460 = 16140
    expect(k.grossMargin).toBe(16140);
    // Plusvalenza: (180000 − 141500) × 26% = 10010 → netto 6130
    expect(k.netMargin).toBe(6130);
    expect(k.durationMonths).toBe(9);
  });

  it("ottimistico: prezzo +5%", () => {
    // 210000 − 8300 − 149020 = 52680; imposte (210000 − 137000) × 26% = 18980
    expect(byKey.OTTIMISTICO!.kpis.netMargin).toBe(33700);
  });

  it("stress test a singola variabile con scostamento dal base", () => {
    const price = plan.stressTests[0]!;
    expect(price.label).toBe("Prezzo di vendita -10%");
    // 180000 − 7400 − 149020 = 23580; imposte (180000 − 137000) × 26% = 11180
    expect(price.netMargin).toBe(12400);
    expect(price.deltaVsBase).toBe(-14200);
    expect(plan.stressTests[1]!.netMargin).toBeLessThan(26600);
    expect(plan.stressTests[2]!.netMargin).toBeLessThan(26600);
  });
});

describe("computeBusinessPlan - cash flow mensile", () => {
  const { cashFlow } = computeBusinessPlan(baseInput);

  it("mese 0: acquisto meno erogazione del mutuo", () => {
    const m0 = cashFlow.months[0]!;
    expect(m0.acquisition).toBe(106100);
    expect(m0.loanDisbursement).toBe(80000);
    expect(m0.net).toBe(-26100);
  });

  it("lavori ripartiti sui mesi di cantiere (default durata − 2)", () => {
    expect(cashFlow.renovationMonths).toBe(4);
    // (37200 + 2000) / 4 = 9800
    expect(cashFlow.months.slice(1, 5).map((m) => m.renovation)).toEqual([9800, 9800, 9800, 9800]);
    expect(cashFlow.months[5]!.renovation).toBe(0);
  });

  it("vendita al mese 6 con rimborso del mutuo e imposte", () => {
    const m6 = cashFlow.months[6]!;
    expect(m6.saleNet).toBe(192000);
    expect(m6.loanPrincipal).toBe(80000);
    expect(m6.loanInterest).toBe(400);
    expect(m6.taxes).toBe(16380);
    // 192000 − 16380 − 220 − 400 − 80000
    expect(m6.net).toBe(95000);
  });

  it("il cumulato finale coincide con l'utile netto", () => {
    expect(cashFlow.months.at(-1)!.cumulative).toBe(26600);
  });

  it("fabbisogno massimo di capitale proprio", () => {
    // −26100 − 4×10420 − 620 = −68400 al mese 5
    expect(cashFlow.peakFundingNeed).toBe(68400);
    expect(cashFlow.peakFundingMonth).toBe(5);
    expect(cashFlow.equityHeadroom).toBe(-8400);
  });

  it("mesi di cantiere personalizzati e invariante sul cumulato", () => {
    const plan = computeBusinessPlan(baseInput, { renovationMonths: 3 });
    expect(plan.cashFlow.months[1]!.renovation).toBe(13066.67);
    expect(plan.cashFlow.months[3]!.renovation).toBe(13066.66);
    expect(plan.cashFlow.months.at(-1)!.cumulative).toBe(26600);
  });

  it("finanziamento più lungo dell'operazione: interessi residui e capitale alla vendita", () => {
    const input: DealFinancialsInput = {
      ...baseInput,
      loans: [{ ...baseInput.loans[0]!, durationMonths: 12, amortizationType: "FRENCH" }],
    };
    const plan = computeBusinessPlan(input);
    expect(plan.cashFlow.months.at(-1)!.cumulative).toBeCloseTo(plan.kpis.netMargin, 2);
  });
});

describe("summarizePreventivo", () => {
  const line = (over: Partial<PreventivoLineInput>): PreventivoLineInput => ({
    id: "x",
    categoryGroup: "LAVORAZIONI",
    categoryName: "Lavorazioni edili",
    description: "voce",
    taxableAmount: 1000,
    vatRatePct: 10,
    isMemo: false,
    isUnbilled: false,
    fromPriceList: true,
    includeInBusinessPlan: false,
    ...over,
  });

  const summary = summarizePreventivo(
    [
      line({ id: "a", taxableAmount: 8000 }),
      line({ id: "b", categoryName: "Lavorazioni idrauliche", taxableAmount: 2000, includeInBusinessPlan: true }),
      line({ id: "c", categoryGroup: "MATERIALI", categoryName: "Pavimenti", taxableAmount: 5000, vatRatePct: 22, fromPriceList: false }),
      line({ id: "d", categoryGroup: "ENTI_ESTERNI", categoryName: "Permessi", taxableAmount: 0, vatRatePct: 0 }),
      line({ id: "e", categoryGroup: "ACQUISIZIONE", categoryName: "Notaio", taxableAmount: 3000 }),
      line({ id: "f", taxableAmount: 9999, isMemo: true }),
    ],
    10,
  );

  it("totali per categoria esclusi acquisizione e memo", () => {
    expect(summary.categories.map((c) => c.categoryName)).toEqual([
      "Lavorazioni edili",
      "Lavorazioni idrauliche",
      "Pavimenti",
      "Permessi",
    ]);
    expect(summary.taxable).toBe(15000);
    // IVA: 800 + 200 + 1100 = 2100
    expect(summary.vat).toBe(2100);
    // Imprevisti 10% su lavorazioni + materiali (15000) = 1500
    expect(summary.contingencyAmount).toBe(1500);
    expect(summary.total).toBe(18600);
  });

  it("voci in evidenza, DA QUOTARE e copertura da libreria", () => {
    expect(summary.highlightedLines.map((l) => l.id)).toEqual(["b"]);
    expect(summary.toQuoteLines.map((l) => l.id)).toEqual(["d"]);
    // 10000 su 15000 dalla libreria
    expect(summary.priceListCoverage).toBeCloseTo(0.6667, 4);
  });
});
