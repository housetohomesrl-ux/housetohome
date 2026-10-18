import { prisma } from "@flipplan/db";
import { computeDealFinancials } from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";
import { dealInclude } from "../lib/dealInclude.js";
import { mapDealToFinancialsInput } from "../lib/mapDealToFinancialsInput.js";
import { computeClientJobSummary } from "../lib/clientJobSummary.js";

// Fatturato/utili dei deal CONCLUSI (status CHIUSO): una riga per deal,
// aggiornata in automatico appena un deal passa a "Concluso", niente di
// inserito a mano qui.
export const revenueRouter = router({
  flip: protectedProcedure.query(async ({ ctx }) => {
    const deals = await prisma.deal.findMany({
      where: { tenantId: ctx.user.tenantId, operationType: "FLIP", status: "CHIUSO" },
      include: dealInclude,
      orderBy: { updatedAt: "desc" },
    });

    const rows = deals.map((deal) => {
      const input = mapDealToFinancialsInput(deal, "REALISTICO");
      const summary = input ? computeDealFinancials(input) : null;
      const realistico = deal.saleScenarios.find((s) => s.scenario === "REALISTICO");
      return {
        id: deal.id,
        name: deal.name,
        address: deal.address,
        updatedAt: deal.updatedAt,
        fatturato: realistico ? realistico.estimatedSalePrice.toNumber() : 0,
        utileLordo: summary ? summary.sale.grossProfitBeforeTax : 0,
        utileNetto: summary ? summary.sale.netProfit : 0,
        datiIncompleti: !summary,
      };
    });

    const totals = rows.reduce(
      (acc, r) => ({
        fatturato: acc.fatturato + r.fatturato,
        utileLordo: acc.utileLordo + r.utileLordo,
        utileNetto: acc.utileNetto + r.utileNetto,
      }),
      { fatturato: 0, utileLordo: 0, utileNetto: 0 },
    );

    return { rows, totals };
  }),

  ristrutturazione: protectedProcedure.query(async ({ ctx }) => {
    const deals = await prisma.deal.findMany({
      where: { tenantId: ctx.user.tenantId, operationType: "RISTRUTTURAZIONE_CLIENTE", status: "CHIUSO" },
      include: dealInclude,
      orderBy: { updatedAt: "desc" },
    });

    const rows = deals.map((deal) => {
      const { grossMargin, netMargin } = computeClientJobSummary(deal);
      return {
        id: deal.id,
        name: deal.name,
        address: deal.address,
        updatedAt: deal.updatedAt,
        utileLordo: grossMargin,
        utileNetto: netMargin,
      };
    });

    const totals = rows.reduce(
      (acc, r) => ({ utileLordo: acc.utileLordo + r.utileLordo, utileNetto: acc.utileNetto + r.utileNetto }),
      { utileLordo: 0, utileNetto: 0 },
    );

    return { rows, totals };
  }),
});
