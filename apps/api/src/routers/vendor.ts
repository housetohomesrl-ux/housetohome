import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@flipplan/db";
import { vendorCreateSchema } from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";

export const vendorRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    prisma.vendor.findMany({ where: { tenantId: ctx.user.tenantId }, orderBy: { name: "asc" } }),
  ),

  create: protectedProcedure.input(vendorCreateSchema).mutation(({ ctx, input }) =>
    prisma.vendor.create({ data: { ...input, tenantId: ctx.user.tenantId } }),
  ),

  update: protectedProcedure
    .input(vendorCreateSchema.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id } });
      if (vendor.tenantId !== ctx.user.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
      return prisma.vendor.update({ where: { id }, data });
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: input.id } });
    if (vendor.tenantId !== ctx.user.tenantId) throw new Error("Not found");
    await prisma.vendor.delete({ where: { id: input.id } });
    return { success: true };
  }),
});
