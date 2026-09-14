import { prisma } from "@flipplan/db";
import { costCategoryCreateSchema } from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";

export const costCategoryRouter = router({
  // Categorie di sistema (tenantId=null) + categorie personalizzate del tenant corrente
  list: protectedProcedure.query(({ ctx }) =>
    prisma.costCategory.findMany({
      where: { OR: [{ tenantId: null }, { tenantId: ctx.user.tenantId }] },
      orderBy: [{ group: "asc" }, { order: "asc" }],
    }),
  ),

  create: protectedProcedure.input(costCategoryCreateSchema).mutation(({ ctx, input }) =>
    prisma.costCategory.create({ data: { ...input, tenantId: ctx.user.tenantId } }),
  ),
});
