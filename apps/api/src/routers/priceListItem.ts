import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@flipplan/db";
import { priceListItemCreateSchema } from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";
import { serializeDecimals } from "../lib/serialize.js";

export const priceListItemRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const items = await prisma.priceListItem.findMany({
      where: { tenantId: ctx.user.tenantId },
      include: { category: true },
      orderBy: { name: "asc" },
    });
    return serializeDecimals(items);
  }),

  create: protectedProcedure.input(priceListItemCreateSchema).mutation(async ({ ctx, input }) => {
    const created = await prisma.priceListItem.create({
      data: { ...input, tenantId: ctx.user.tenantId },
      include: { category: true },
    });
    return serializeDecimals(created);
  }),

  update: protectedProcedure
    .input(priceListItemCreateSchema.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const item = await prisma.priceListItem.findUniqueOrThrow({ where: { id } });
      if (item.tenantId !== ctx.user.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = await prisma.priceListItem.update({ where: { id }, data, include: { category: true } });
      return serializeDecimals(updated);
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const item = await prisma.priceListItem.findUniqueOrThrow({ where: { id: input.id } });
    if (item.tenantId !== ctx.user.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
    await prisma.priceListItem.delete({ where: { id: input.id } });
    return { success: true };
  }),
});
