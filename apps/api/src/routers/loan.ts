import { z } from "zod";
import { prisma } from "@flipplan/db";
import { loanCreateSchema, loanUpdateSchema } from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";
import { assertDealAccess } from "../lib/tenantAccess.js";
import { serializeDecimals } from "../lib/serialize.js";

async function assertLoanAccess(tenantId: string, id: string) {
  const loan = await prisma.loan.findUniqueOrThrow({ where: { id } });
  await assertDealAccess(tenantId, loan.dealId);
  return loan;
}

export const loanRouter = router({
  create: protectedProcedure.input(loanCreateSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const { manualPayments, ...loanData } = input;
    const created = await prisma.loan.create({
      data: {
        ...loanData,
        manualPayments: manualPayments ? { createMany: { data: manualPayments } } : undefined,
      },
      include: { manualPayments: true },
    });
    return serializeDecimals(created);
  }),

  update: protectedProcedure.input(loanUpdateSchema).mutation(async ({ ctx, input }) => {
    await assertLoanAccess(ctx.user.tenantId, input.id);
    const { id, manualPayments, ...loanData } = input;
    const updated = await prisma.$transaction(async (tx) => {
      if (manualPayments) {
        await tx.loanPayment.deleteMany({ where: { loanId: id } });
        await tx.loanPayment.createMany({ data: manualPayments.map((p) => ({ ...p, loanId: id })) });
      }
      return tx.loan.update({ where: { id }, data: loanData, include: { manualPayments: true } });
    });
    return serializeDecimals(updated);
  }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await assertLoanAccess(ctx.user.tenantId, input.id);
    await prisma.loan.delete({ where: { id: input.id } });
    return { success: true };
  }),
});
