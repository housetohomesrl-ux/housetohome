import { prisma } from "@flipplan/db";
import {
  acquisitionDetailsSchema,
  fiscalSettingsSchema,
  holdingCostsConfigSchema,
  renovationSettingsSchema,
} from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";
import { assertDealAccess } from "../lib/tenantAccess.js";
import { serializeDecimals } from "../lib/serialize.js";

// Le quattro sezioni 1:1 del deal (acquisizione, fiscale, ristrutturazione,
// detenzione) sono sempre create con dei default al momento della creazione
// del deal (vedi deal.ts), quindi qui esponiamo solo l'upsert.

export const dealSettingsRouter = router({
  updateAcquisitionDetails: protectedProcedure.input(acquisitionDetailsSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const { dealId, ...data } = input;
    const updated = await prisma.acquisitionDetails.update({ where: { dealId }, data });
    return serializeDecimals(updated);
  }),

  updateFiscalSettings: protectedProcedure.input(fiscalSettingsSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const { dealId, ...data } = input;
    const updated = await prisma.fiscalSettings.update({ where: { dealId }, data });
    return serializeDecimals(updated);
  }),

  updateRenovationSettings: protectedProcedure.input(renovationSettingsSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const { dealId, ...data } = input;
    const updated = await prisma.renovationSettings.update({ where: { dealId }, data });
    return serializeDecimals(updated);
  }),

  updateHoldingCosts: protectedProcedure.input(holdingCostsConfigSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const { dealId, ...data } = input;
    const updated = await prisma.holdingCostsConfig.update({ where: { dealId }, data });
    return serializeDecimals(updated);
  }),
});
