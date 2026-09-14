import { z } from "zod";
import { prisma } from "@flipplan/db";
import { noteCreateSchema } from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";
import { assertDealAccess } from "../lib/tenantAccess.js";

export const noteRouter = router({
  create: protectedProcedure.input(noteCreateSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    return prisma.note.create({ data: { ...input, createdById: ctx.user.id } });
  }),

  resolve: protectedProcedure
    .input(z.object({ id: z.string(), isResolved: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const note = await prisma.note.findUniqueOrThrow({ where: { id: input.id } });
      await assertDealAccess(ctx.user.tenantId, note.dealId);
      return prisma.note.update({
        where: { id: input.id },
        data: { isResolved: input.isResolved, resolvedAt: input.isResolved ? new Date() : null },
      });
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const note = await prisma.note.findUniqueOrThrow({ where: { id: input.id } });
    await assertDealAccess(ctx.user.tenantId, note.dealId);
    await prisma.note.delete({ where: { id: input.id } });
    return { success: true };
  }),
});
