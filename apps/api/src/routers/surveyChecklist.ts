import { z } from "zod";
import { prisma } from "@flipplan/db";
import { protectedProcedure, router } from "../trpc.js";
import { assertDealAccess } from "../lib/tenantAccess.js";

// Voci flaggate nella Lista sopralluogo di un deal (vedi SiteSurveyTab):
// l'esistenza della riga È il flag, salvata per poter riprendere un
// sopralluogo lasciato a metà senza perdere la selezione.
export const surveyChecklistRouter = router({
  list: protectedProcedure.input(z.object({ dealId: z.string() })).query(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const entries = await prisma.surveyChecklistEntry.findMany({ where: { dealId: input.dealId } });
    return entries.map((e) => e.priceListItemId);
  }),

  toggle: protectedProcedure
    .input(z.object({ dealId: z.string(), priceListItemId: z.string(), checked: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertDealAccess(ctx.user.tenantId, input.dealId);
      if (input.checked) {
        await prisma.surveyChecklistEntry.upsert({
          where: { dealId_priceListItemId: { dealId: input.dealId, priceListItemId: input.priceListItemId } },
          create: { dealId: input.dealId, priceListItemId: input.priceListItemId },
          update: {},
        });
      } else {
        await prisma.surveyChecklistEntry.deleteMany({
          where: { dealId: input.dealId, priceListItemId: input.priceListItemId },
        });
      }
      return { success: true };
    }),
});
