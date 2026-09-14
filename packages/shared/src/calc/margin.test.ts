import { describe, expect, it } from "vitest";
import { computeDealFinancials } from "./margin.js";
import type { DealFinancialsInput } from "./types.js";

// Scenario interamente verificato a mano (vedi commenti). Numeri scelti per
// dare risultati esatti (senza codini decimali infiniti) dove possibile, in
// modo da poter controllare ogni singola formula passo per passo.
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

describe("computeDealFinancials - scenario integrato (PERSONA_FISICA, IVA non recuperabile)", () => {
  const result = computeDealFinancials(baseInput);

  it("costo totale di progetto (IVA inclusa perché non recuperabile)", () => {
    // Acquisizione: 100000 + (5000 + 22% = 6100) = 106100
    expect(result.totals.totalAcquisitionCost).toBe(106100);
    // Ristrutturazione: LAV(20000+10%=22000) + MAT(10000+22%=12200) + contingency(10% su 30000=3000) = 37200
    expect(result.totals.totalRenovationCost).toBe(37200);
    // Enti esterni: 2000 (0% IVA)
    expect(result.totals.totalEntiEsterniCost).toBe(2000);
    // Detenzione: (50+50+80+40)*6 = 1320 fissi + interessi 80000*0.5%*6=2400 => 3720
    expect(result.holding.total).toBe(3720);
    // Totale: 106100+37200+2000+0+3720
    expect(result.totals.totalProjectCost).toBe(149020);
  });

  it("margine lordo, imposte e utile netto", () => {
    // Costi vendita: 200000*3% + 1500 + 500 = 8000
    expect(result.sale.saleCosts).toBe(8000);
    // Margine lordo: 200000 - 8000 - 149020 = 42980
    expect(result.sale.grossProfitBeforeTax).toBe(42980);
    // Base plusvalenza (stima): 200000 - (100000 + costi netti 37000) = 63000
    // costi netti (non-memo, imponibili): 5000+20000+10000+2000 = 37000
    // imposta sostitutiva 26%: 63000*0.26 = 16380
    expect(result.taxes.totalTax).toBe(16380);
    // Utile netto: 42980 - 16380 = 26600
    expect(result.sale.netProfit).toBe(26600);
  });

  it("ROI, margine %, cash-on-cash", () => {
    expect(result.kpis.roi).toBeCloseTo(26600 / 149020, 4);
    expect(result.kpis.marginOnRevenuePct).toBe(13.3); // 26600/200000*100, esatto
    expect(result.kpis.equityInvested).toBe(60000);
    expect(result.kpis.cashOnCash).toBeCloseTo(26600 / 60000, 4);
    expect(result.kpis.cashOnCashAnnualized).toBeCloseTo((26600 / 60000) * (12 / 6), 4);
  });

  it("fonti e impieghi: segnala la copertura negativa e calcola la cassa netta finale", () => {
    // Fonti: equity 60000 + mutuo 80000 = 140000; Impieghi: 149020 => copertura -9020 (sotto copertura)
    expect(result.sourcesAndUses.sourcesTotal).toBe(140000);
    expect(result.sourcesAndUses.coverage).toBe(-9020);
    expect(result.sourcesAndUses.isUndercovered).toBe(true);

    // Capitale mutuo da restituire alla vendita (interest-only => intero capitale): 80000
    expect(result.sourcesAndUses.loanPrincipalRepaidAtSale).toBe(80000);

    // Costi ancora da pagare: nessun pagamento registrato => intero totale con IVA delle righe non-memo
    // 6100 (ACQ) + 22000 (LAV) + 12200 (MAT) + 2000 (ENTI) = 42300
    expect(result.sourcesAndUses.remainingUnpaidCosts).toBe(42300);

    // Cassa netta finale: 200000 - 8000 - 80000 - 16380 - 42300 - 0(saldo IVA) = 53320
    expect(result.sourcesAndUses.finalNetCashToEquity).toBe(53320);
  });

  it("breakeven: il margine lordo al prezzo di pareggio è ~0", () => {
    const s = result.kpis.breakevenSalePrice;
    const saleCosts = (s * baseInput.saleScenario.agencyFeesSellPct) / 100 + baseInput.saleScenario.marketingStagingCosts + baseInput.saleScenario.closingCosts;
    const grossProfit = s - saleCosts - result.totals.totalProjectCost;
    expect(grossProfit).toBeCloseTo(0, 1);
  });
});

describe("computeDealFinancials - IVA su costi recuperabile", () => {
  it("usa gli imponibili (non gli importi con IVA) nei totali di progetto", () => {
    const input: DealFinancialsInput = {
      ...baseInput,
      fiscalSettings: { ...baseInput.fiscalSettings, costsVatRecoverable: true },
    };
    const result = computeDealFinancials(input);
    // Acquisizione: 100000 + 5000 (netto, non 6100) = 105000
    expect(result.totals.totalAcquisitionCost).toBe(105000);
    // Ristrutturazione: 20000 + 10000 + 3000 (contingency) = 33000 (netti, non 34200)
    expect(result.totals.totalRenovationCost).toBe(33000);
  });
});
