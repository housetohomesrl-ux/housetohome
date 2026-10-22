import { z } from "zod";
import { prisma } from "@flipplan/db";
import {
  computeDealFinancials,
  computeDoubleEntrySensitivityMatrix,
  computeSingleVariableSensitivity,
  saleScenarioTypeSchema,
} from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";
import { assertDealAccess } from "../lib/tenantAccess.js";
import { dealInclude } from "../lib/dealInclude.js";
import { buildFinancialsInput } from "../lib/buildFinancialsInput.js";

const scenarioInput = z.object({ dealId: z.string(), scenario: saleScenarioTypeSchema.default("REALISTICO") });

async function loadFullDeal(tenantId: string, dealId: string) {
  await assertDealAccess(tenantId, dealId);
  return prisma.deal.findUniqueOrThrow({ where: { id: dealId }, include: dealInclude });
}

export const resultsRouter = router({
  forDeal: protectedProcedure.input(scenarioInput).query(async ({ ctx, input }) => {
    const deal = await loadFullDeal(ctx.user.tenantId, input.dealId);
    const financialsInput = await buildFinancialsInput(ctx.user.tenantId, deal, input.scenario);
    if (!financialsInput) return { isComplete: false as const, result: null };
    return { isComplete: true as const, result: computeDealFinancials(financialsInput) };
  }),

  allScenarios: protectedProcedure.input(z.object({ dealId: z.string() })).query(async ({ ctx, input }) => {
    const deal = await loadFullDeal(ctx.user.tenantId, input.dealId);
    const scenarios = ["PRUDENTE", "REALISTICO", "OTTIMISTICO"] as const;
    return Promise.all(
      scenarios.map(async (scenario) => {
        const financialsInput = await buildFinancialsInput(ctx.user.tenantId, deal, scenario);
        return {
          scenario,
          isComplete: Boolean(financialsInput),
          result: financialsInput ? computeDealFinancials(financialsInput) : null,
        };
      }),
    );
  }),

  sensitivity: protectedProcedure.input(scenarioInput).query(async ({ ctx, input }) => {
    const deal = await loadFullDeal(ctx.user.tenantId, input.dealId);
    const financialsInput = await buildFinancialsInput(ctx.user.tenantId, deal, input.scenario);
    if (!financialsInput) return { isComplete: false as const, result: null };
    return { isComplete: true as const, result: computeSingleVariableSensitivity(financialsInput) };
  }),

  sensitivityMatrix: protectedProcedure.input(scenarioInput).query(async ({ ctx, input }) => {
    const deal = await loadFullDeal(ctx.user.tenantId, input.dealId);
    const financialsInput = await buildFinancialsInput(ctx.user.tenantId, deal, input.scenario);
    if (!financialsInput) return { isComplete: false as const, result: null };
    return { isComplete: true as const, result: computeDoubleEntrySensitivityMatrix(financialsInput) };
  }),
});
