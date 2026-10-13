import { z } from "zod";
import { prisma } from "@flipplan/db";
import { computeBusinessPlan, saleScenarioTypeSchema, summarizePreventivo } from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";
import { assertDealAccess } from "../lib/tenantAccess.js";
import { dealInclude } from "../lib/dealInclude.js";
import { mapDealToFinancialsInput } from "../lib/mapDealToFinancialsInput.js";
import { serializeDecimals } from "../lib/serialize.js";

// Il business plan legge le stesse righe del preventivo del deal, più fornitore
// e flag "Aggiungi a business plan" della voce di Libreria prezzi collegata.
const businessPlanInclude = {
  ...dealInclude,
  costLineItems: {
    include: { category: true, vendor: true, priceListItem: { select: { includeInBusinessPlan: true } } },
    orderBy: { order: "asc" as const },
  },
};

export const businessPlanRouter = router({
  forDeal: protectedProcedure
    .input(
      z.object({
        dealId: z.string(),
        scenario: saleScenarioTypeSchema.default("REALISTICO"),
        renovationMonths: z.number().int().min(1).max(60).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertDealAccess(ctx.user.tenantId, input.dealId);
      const deal = await prisma.deal.findUniqueOrThrow({ where: { id: input.dealId }, include: businessPlanInclude });

      const preventivo = summarizePreventivo(
        deal.costLineItems.map((item) => ({
          id: item.id,
          categoryGroup: item.category.group,
          categoryName: item.category.name,
          description: item.description,
          taxableAmount: item.taxableAmount.toNumber(),
          vatRatePct: item.vatRatePct.toNumber(),
          isMemo: item.isMemo,
          isUnbilled: item.isUnbilled,
          vendorName: item.vendor?.name ?? null,
          fromPriceList: Boolean(item.priceListItemId),
          includeInBusinessPlan: item.priceListItem?.includeInBusinessPlan ?? false,
        })),
        deal.renovationSettings?.contingencyPct.toNumber() ?? 0,
      );

      const financialsInput = mapDealToFinancialsInput(deal, input.scenario);
      const plan = financialsInput
        ? computeBusinessPlan(financialsInput, { renovationMonths: input.renovationMonths })
        : null;

      return {
        isComplete: Boolean(plan),
        deal: {
          name: deal.name,
          address: deal.address,
          propertyType: deal.propertyType,
          status: deal.status,
          isDemo: deal.isDemo,
          purchasePrice: deal.acquisitionDetails?.purchasePrice.toNumber() ?? 0,
          regimeType: deal.fiscalSettings?.regimeType ?? null,
          costsVatRecoverable: deal.fiscalSettings?.costsVatRecoverable ?? false,
        },
        acquisitionLines: serializeDecimals(
          deal.costLineItems
            .filter((item) => item.category.group === "ACQUISIZIONE" && !item.isMemo)
            .map((item) => ({ id: item.id, categoryName: item.category.name, description: item.description, taxableAmount: item.taxableAmount, vatRatePct: item.vatRatePct })),
        ),
        loans: serializeDecimals(
          deal.loans.map((l) => ({ id: l.id, name: l.name, type: l.type, principalAmount: l.principalAmount, annualInterestRatePct: l.annualInterestRatePct, durationMonths: l.durationMonths, amortizationType: l.amortizationType })),
        ),
        partners: serializeDecimals(
          deal.partners.map((p) => ({ id: p.id, name: p.name, contributionAmount: p.contributionAmount, profitSharePct: p.profitSharePct })),
        ),
        openNotes: deal.notes
          .filter((n) => !n.isResolved && n.severity !== "INFO")
          .map((n) => ({ id: n.id, text: n.text, severity: n.severity })),
        preventivo,
        plan,
      };
    }),
});
