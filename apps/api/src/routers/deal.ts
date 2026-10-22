import { computeDealFinancials } from "@flipplan/shared";
import { dealCreateSchema, dealUpdateSchema } from "@flipplan/shared";
import { prisma } from "@flipplan/db";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";
import { assertDealAccess } from "../lib/tenantAccess.js";
import { dealInclude } from "../lib/dealInclude.js";
import { mapDealToFinancialsInput } from "../lib/mapDealToFinancialsInput.js";
import { computeClientJobSummary, computeClientDueBalance, computeOverdueInstallments } from "../lib/clientJobSummary.js";
import { serializeDecimals } from "../lib/serialize.js";

const SALE_SCENARIO_DEFAULTS = [
  { scenario: "PRUDENTE" as const, agencyFeesSellPct: 3 },
  { scenario: "REALISTICO" as const, agencyFeesSellPct: 3 },
  { scenario: "OTTIMISTICO" as const, agencyFeesSellPct: 3 },
];

export const dealRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const deals = await prisma.deal.findMany({
      where: { tenantId: ctx.user.tenantId },
      include: dealInclude,
      orderBy: { updatedAt: "desc" },
    });

    return deals.map((deal) => {
      const base = {
        id: deal.id,
        name: deal.name,
        address: deal.address,
        propertyType: deal.propertyType,
        operationType: deal.operationType,
        status: deal.status,
        isDemo: deal.isDemo,
        updatedAt: deal.updatedAt,
        quoteStatus: deal.quoteStatus,
        quoteValidUntil: deal.quoteValidUntil,
        dueFromClient: deal.operationType === "RISTRUTTURAZIONE_CLIENTE" ? computeClientDueBalance(deal) : null,
        overdueInstallments: deal.operationType === "RISTRUTTURAZIONE_CLIENTE" ? computeOverdueInstallments(deal) : [],
      };

      // Ristrutturazione per un cliente: niente acquisto/vendita immobile,
      // quindi niente ROI/plusvalenza — solo il margine netto sulla
      // ristrutturazione (stessa formula della tab Risultati del deal).
      if (deal.operationType === "RISTRUTTURAZIONE_CLIENTE") {
        return { ...base, summary: { netProfit: computeClientJobSummary(deal).netMargin, roi: null, totalProjectCost: null } };
      }

      const input = mapDealToFinancialsInput(deal, "REALISTICO");
      const summary = input ? computeDealFinancials(input) : null;
      return {
        ...base,
        summary: summary
          ? { netProfit: summary.sale.netProfit, roi: summary.kpis.roi, totalProjectCost: summary.totals.totalProjectCost }
          : null,
      };
    });
  }),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.id);
    const deal = await prisma.deal.findUniqueOrThrow({ where: { id: input.id }, include: dealInclude });
    return serializeDecimals(deal);
  }),

  create: protectedProcedure.input(dealCreateSchema).mutation(async ({ ctx, input }) => {
    return prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({
        data: {
          tenantId: ctx.user.tenantId,
          createdById: ctx.user.id,
          name: input.name,
          address: input.address,
          propertyType: input.propertyType,
          status: input.status,
        },
      });
      await tx.acquisitionDetails.create({ data: { dealId: deal.id, purchasePrice: 0 } });
      await tx.fiscalSettings.create({
        data: {
          dealId: deal.id,
          regimeType: "PERSONA_FISICA",
          saleSubjectToVat: false,
          costsVatRecoverable: false,
        },
      });
      await tx.renovationSettings.create({ data: { dealId: deal.id, contingencyPct: 12 } });
      await tx.holdingCostsConfig.create({ data: { dealId: deal.id, durationMonths: 6 } });
      await tx.saleScenario.createMany({
        data: SALE_SCENARIO_DEFAULTS.map((s) => ({
          dealId: deal.id,
          scenario: s.scenario,
          estimatedSalePrice: 0,
          agencyFeesSellPct: s.agencyFeesSellPct,
        })),
      });
      const created = await tx.deal.findUniqueOrThrow({ where: { id: deal.id }, include: dealInclude });
      return serializeDecimals(created);
    });
  }),

  update: protectedProcedure.input(dealUpdateSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.id);
    const { id, ...data } = input;
    return prisma.deal.update({ where: { id }, data });
  }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.id);
    await prisma.deal.delete({ where: { id: input.id } });
    return { success: true };
  }),
});
