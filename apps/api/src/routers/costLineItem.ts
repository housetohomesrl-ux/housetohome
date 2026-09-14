import { z } from "zod";
import { prisma } from "@flipplan/db";
import { costLineItemCreateSchema, costLineItemUpdateSchema, quoteCreateSchema } from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";
import { assertDealAccess } from "../lib/tenantAccess.js";
import { serializeDecimals } from "../lib/serialize.js";

async function assertCostLineItemAccess(tenantId: string, id: string) {
  const item = await prisma.costLineItem.findUniqueOrThrow({ where: { id } });
  await assertDealAccess(tenantId, item.dealId);
  return item;
}

export const costLineItemRouter = router({
  create: protectedProcedure.input(costLineItemCreateSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const created = await prisma.costLineItem.create({ data: input, include: { category: true } });
    return serializeDecimals(created);
  }),

  update: protectedProcedure.input(costLineItemUpdateSchema).mutation(async ({ ctx, input }) => {
    await assertCostLineItemAccess(ctx.user.tenantId, input.id);
    const { id, ...data } = input;
    const updated = await prisma.costLineItem.update({ where: { id }, data, include: { category: true } });
    return serializeDecimals(updated);
  }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await assertCostLineItemAccess(ctx.user.tenantId, input.id);
    await prisma.costLineItem.delete({ where: { id: input.id } });
    return { success: true };
  }),

  addQuote: protectedProcedure.input(quoteCreateSchema).mutation(async ({ ctx, input }) => {
    await assertCostLineItemAccess(ctx.user.tenantId, input.costLineItemId);
    const quote = await prisma.quote.create({ data: input });
    return serializeDecimals(quote);
  }),

  selectQuote: protectedProcedure
    .input(z.object({ costLineItemId: z.string(), quoteId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await assertCostLineItemAccess(ctx.user.tenantId, input.costLineItemId);
      const updated = await prisma.costLineItem.update({
        where: { id: input.costLineItemId },
        data: { selectedQuoteId: input.quoteId },
      });
      return serializeDecimals(updated);
    }),

  listQuotes: protectedProcedure.input(z.object({ costLineItemId: z.string() })).query(async ({ ctx, input }) => {
    await assertCostLineItemAccess(ctx.user.tenantId, input.costLineItemId);
    const quotes = await prisma.quote.findMany({ where: { costLineItemId: input.costLineItemId }, orderBy: { createdAt: "desc" } });
    return serializeDecimals(quotes);
  }),
});
