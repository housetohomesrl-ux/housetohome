import { z } from "zod";
import { prisma } from "@flipplan/db";
import { partnerCreateSchema, partnerUpdateSchema } from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";
import { assertDealAccess } from "../lib/tenantAccess.js";
import { serializeDecimals } from "../lib/serialize.js";

async function assertPartnerAccess(tenantId: string, id: string) {
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id } });
  await assertDealAccess(tenantId, partner.dealId);
  return partner;
}

export const partnerRouter = router({
  create: protectedProcedure.input(partnerCreateSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const created = await prisma.partner.create({ data: input });
    return serializeDecimals(created);
  }),

  update: protectedProcedure.input(partnerUpdateSchema).mutation(async ({ ctx, input }) => {
    await assertPartnerAccess(ctx.user.tenantId, input.id);
    const { id, ...data } = input;
    const updated = await prisma.partner.update({ where: { id }, data });
    return serializeDecimals(updated);
  }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await assertPartnerAccess(ctx.user.tenantId, input.id);
    await prisma.partner.delete({ where: { id: input.id } });
    return { success: true };
  }),
});
