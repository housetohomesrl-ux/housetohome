import { z } from "zod";
import type { QuoteSnapshot } from "@flipplan/db";
import { prisma } from "@flipplan/db";
import { quoteSnapshotCreateSchema } from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";
import { assertDealAccess } from "../lib/tenantAccess.js";

type SnapshotItem = {
  description: string;
  quantity: number | null;
  unit: string | null;
  price: number;
  cost?: number;
};

// Il campo items è JSON: lo mappiamo esplicitamente qui (invece di passare
// per serializeDecimals<T>, generico) perché composto con il tipo Json di
// Prisma manda in excessively-deep l'inferenza dei tipi lato tRPC/frontend.
function toClient(s: QuoteSnapshot) {
  return {
    id: s.id,
    dealId: s.dealId,
    createdAt: s.createdAt,
    grandTotal: s.grandTotal.toNumber(),
    vatRatePct: s.vatRatePct.toNumber(),
    items: s.items as unknown as SnapshotItem[],
  };
}

export const quoteSnapshotRouter = router({
  list: protectedProcedure.input(z.object({ dealId: z.string() })).query(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const snapshots = await prisma.quoteSnapshot.findMany({
      where: { dealId: input.dealId },
      orderBy: { createdAt: "desc" },
    });
    return snapshots.map(toClient);
  }),

  create: protectedProcedure.input(quoteSnapshotCreateSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const created = await prisma.quoteSnapshot.create({
      data: {
        dealId: input.dealId,
        grandTotal: input.grandTotal,
        vatRatePct: input.vatRatePct,
        items: input.items,
      },
    });
    return toClient(created);
  }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const snapshot = await prisma.quoteSnapshot.findUniqueOrThrow({ where: { id: input.id } });
    await assertDealAccess(ctx.user.tenantId, snapshot.dealId);
    await prisma.quoteSnapshot.delete({ where: { id: input.id } });
    return { success: true };
  }),
});
