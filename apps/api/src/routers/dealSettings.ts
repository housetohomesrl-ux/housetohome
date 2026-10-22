import { prisma } from "@flipplan/db";
import {
  acquisitionDetailsSchema,
  dealVendorPaymentSchema,
  fiscalSettingsSchema,
  holdingCostsConfigSchema,
  renovationSettingsSchema,
} from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";
import { assertDealAccess } from "../lib/tenantAccess.js";
import { serializeDecimals } from "../lib/serialize.js";
import { syncRegistrationTaxLineItem } from "../lib/syncRegistrationTaxLineItem.js";

// Le quattro sezioni 1:1 del deal (acquisizione, fiscale, ristrutturazione,
// detenzione) sono sempre create con dei default al momento della creazione
// del deal (vedi deal.ts), quindi qui esponiamo solo l'upsert.

export const dealSettingsRouter = router({
  updateAcquisitionDetails: protectedProcedure.input(acquisitionDetailsSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const { dealId, ...data } = input;
    const updated = await prisma.acquisitionDetails.update({ where: { dealId }, data });
    await syncRegistrationTaxLineItem(dealId, ctx.user.tenantId);
    return serializeDecimals(updated);
  }),

  updateFiscalSettings: protectedProcedure.input(fiscalSettingsSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const { dealId, ...data } = input;
    const updated = await prisma.fiscalSettings.update({ where: { dealId }, data });
    await syncRegistrationTaxLineItem(dealId, ctx.user.tenantId);
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

  // Aggiorna solo le rate passate (di solito una alla volta, al blur di un
  // singolo riquadro), lasciando intatte le altre già salvate.
  upsertVendorPayment: protectedProcedure.input(dealVendorPaymentSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const { dealId, vendorId, ...data } = input;
    const upserted = await prisma.dealVendorPayment.upsert({
      where: { dealId_vendorId: { dealId, vendorId } },
      create: { dealId, vendorId, ...data },
      update: data,
    });
    return serializeDecimals(upserted);
  }),
});
