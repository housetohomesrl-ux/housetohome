import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@flipplan/db";
import { costTemplateCreateSchema, dealOperationTypeSchema } from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";
import { serializeDecimals } from "../lib/serialize.js";

export const costTemplateRouter = router({
  list: protectedProcedure.input(z.object({ libraryScope: dealOperationTypeSchema.optional() })).query(async ({ ctx, input }) => {
    const templates = await prisma.costTemplate.findMany({
      where: { tenantId: ctx.user.tenantId, libraryScope: input.libraryScope },
      include: { items: { include: { priceListItem: { include: { vendor: true, category: true } } } } },
      orderBy: { name: "asc" },
    });
    return serializeDecimals(templates);
  }),

  create: protectedProcedure.input(costTemplateCreateSchema).mutation(async ({ ctx, input }) => {
    const created = await prisma.costTemplate.create({
      data: {
        tenantId: ctx.user.tenantId,
        name: input.name,
        libraryScope: input.libraryScope,
        items: {
          create: input.items.map((item, i) => ({
            priceListItemId: item.priceListItemId,
            quantity: item.quantity,
            order: i,
          })),
        },
      },
      include: { items: { include: { priceListItem: { include: { vendor: true, category: true } } } } },
    });
    return serializeDecimals(created);
  }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const template = await prisma.costTemplate.findUniqueOrThrow({ where: { id: input.id } });
    if (template.tenantId !== ctx.user.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
    await prisma.costTemplate.delete({ where: { id: input.id } });
    return { success: true };
  }),
});
