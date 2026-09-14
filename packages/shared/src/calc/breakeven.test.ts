import { describe, expect, it } from "vitest";
import { computeBreakevenSalePrice } from "./breakeven.js";

describe("computeBreakevenSalePrice", () => {
  it("S = (costoTotale + marketing + chiusura) / (1 - %agenzia/100)", () => {
    const s = computeBreakevenSalePrice({
      totalProjectCost: 149020,
      agencyFeesSellPct: 3,
      marketingStagingCosts: 1500,
      closingCosts: 500,
    });
    // 151020 / 0.97 = 155690.7216...
    expect(s).toBeCloseTo(155690.72, 1);
  });

  it("al prezzo di pareggio, il margine lordo (ricalcolato con la stessa formula) è ~0", () => {
    const totalProjectCost = 149020;
    const agencyFeesSellPct = 3;
    const marketingStagingCosts = 1500;
    const closingCosts = 500;
    const s = computeBreakevenSalePrice({ totalProjectCost, agencyFeesSellPct, marketingStagingCosts, closingCosts });

    const saleCosts = (s * agencyFeesSellPct) / 100 + marketingStagingCosts + closingCosts;
    const grossProfit = s - saleCosts - totalProjectCost;
    expect(grossProfit).toBeCloseTo(0, 1);
  });
});
