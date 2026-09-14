import { describe, expect, it } from "vitest";
import { aggregateCostLineItems } from "./costs.js";
import type { CostLineItemInput } from "./types.js";

describe("aggregateCostLineItems", () => {
  const items: CostLineItemInput[] = [
    { id: "1", categoryGroup: "ACQUISIZIONE", taxableAmount: 1000, vatRatePct: 22, paidAmount: 500, isMemo: false, isUnbilled: false },
    { id: "2", categoryGroup: "LAVORAZIONI", taxableAmount: 2000, vatRatePct: 10, paidAmount: 0, isMemo: false, isUnbilled: false },
    { id: "3", categoryGroup: "MATERIALI", taxableAmount: 1000, vatRatePct: 22, paidAmount: 0, isMemo: false, isUnbilled: false },
    // riga memo: materiale già incluso nel preventivo dell'impresa, esclusa da OGNI totale
    { id: "4", categoryGroup: "MATERIALI", taxableAmount: 500, vatRatePct: 22, paidAmount: 0, isMemo: true, isUnbilled: false },
    // riga in contanti/non fatturata: inclusa nei totali ma segnalata a parte
    { id: "5", categoryGroup: "ALTRO", taxableAmount: 300, vatRatePct: 0, paidAmount: 300, isMemo: false, isUnbilled: true },
  ];

  it("calcola i subtotali per gruppo escludendo le righe memo", () => {
    const result = aggregateCostLineItems(items, 10);

    expect(result.byGroup.ACQUISIZIONE).toEqual({
      taxableTotal: 1000,
      vatTotal: 220,
      totalWithVat: 1220,
      paidTotal: 500,
      dueTotal: 720,
    });
    expect(result.byGroup.LAVORAZIONI.taxableTotal).toBe(2000);
    expect(result.byGroup.LAVORAZIONI.totalWithVat).toBe(2200);
    // la riga memo (500) NON compare nel totale MATERIALI
    expect(result.byGroup.MATERIALI.taxableTotal).toBe(1000);
    expect(result.byGroup.ALTRO.taxableTotal).toBe(300);
  });

  it("applica la contingency solo su LAVORAZIONI + MATERIALI (non su acquisizione/enti esterni)", () => {
    const result = aggregateCostLineItems(items, 10);
    // base = 2000 (LAVORAZIONI) + 1000 (MATERIALI, riga memo esclusa) = 3000
    expect(result.contingencyBaseTaxable).toBe(3000);
    expect(result.contingencyAmount).toBe(300);
  });

  it("esclude le righe memo dai totali complessivi ma le riporta a parte", () => {
    const result = aggregateCostLineItems(items, 10);
    expect(result.memoTaxableTotal).toBe(500);
    expect(result.nonMemoTaxableTotal).toBe(1000 + 2000 + 1000 + 300);
    expect(result.nonMemoVatTotal).toBe(220 + 200 + 220 + 0);
    expect(result.nonMemoTotalWithVat).toBe(4940);
    expect(result.nonMemoPaidTotal).toBe(800);
    expect(result.nonMemoDueTotal).toBe(4140);
  });

  it("riporta il subtotale informativo delle righe non fatturate/contanti", () => {
    const result = aggregateCostLineItems(items, 10);
    expect(result.unbilledTaxableTotal).toBe(300);
  });
});
