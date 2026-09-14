import { prisma } from "@flipplan/db";
import { saleScenarioUpsertSchema } from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";
import { assertDealAccess } from "../lib/tenantAccess.js";
import { serializeDecimals } from "../lib/serialize.js";

export const saleScenarioRouter = router({
  upsert: protectedProcedure.input(saleScenarioUpsertSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const { dealId, scenario, ...data } = input;
    const upserted = await prisma.saleScenario.upsert({
      where: { dealId_scenario: { dealId, scenario } },
      create: { dealId, scenario, ...data },
      update: data,
    });
    return serializeDecimals(upserted);
  }),
});
