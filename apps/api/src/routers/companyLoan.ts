import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@flipplan/db";
import { companyLoanCreateSchema, companyLoanPaymentBulkImportSchema, companyLoanUpdateSchema } from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";
import { serializeDecimals } from "../lib/serialize.js";

export const companyLoanRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const loans = await prisma.companyLoan.findMany({
      where: { tenantId: ctx.user.tenantId },
      include: { payments: { orderBy: { dueDate: "asc" } } },
      orderBy: { name: "asc" },
    });
    return serializeDecimals(loans);
  }),

  create: protectedProcedure.input(companyLoanCreateSchema).mutation(({ ctx, input }) =>
    prisma.companyLoan.create({ data: { ...input, tenantId: ctx.user.tenantId } }),
  ),

  update: protectedProcedure.input(companyLoanUpdateSchema).mutation(async ({ ctx, input }) => {
    const loan = await prisma.companyLoan.findUniqueOrThrow({ where: { id: input.id } });
    if (loan.tenantId !== ctx.user.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
    return prisma.companyLoan.update({ where: { id: input.id }, data: { companyOnly: input.companyOnly } });
  }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const loan = await prisma.companyLoan.findUniqueOrThrow({ where: { id: input.id } });
    if (loan.tenantId !== ctx.user.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
    await prisma.companyLoan.delete({ where: { id: input.id } });
    return { success: true };
  }),

  // Importa (o sostituisce) il piano di ammortamento reale di un
  // CompanyLoan: cancella le rate esistenti e inserisce quelle nuove, per
  // poter ricaricare un documento corretto senza duplicare righe.
  bulkImportPayments: protectedProcedure.input(companyLoanPaymentBulkImportSchema).mutation(async ({ ctx, input }) => {
    const loan = await prisma.companyLoan.findUniqueOrThrow({ where: { id: input.companyLoanId } });
    if (loan.tenantId !== ctx.user.tenantId) throw new TRPCError({ code: "NOT_FOUND" });

    await prisma.$transaction([
      prisma.companyLoanPayment.deleteMany({ where: { companyLoanId: input.companyLoanId } }),
      prisma.companyLoanPayment.createMany({
        data: input.payments.map((p) => ({
          companyLoanId: input.companyLoanId,
          dueDate: p.dueDate,
          principalPortion: p.principalPortion,
          interestPortion: p.interestPortion,
        })),
      }),
    ]);

    return { imported: input.payments.length };
  }),
});
