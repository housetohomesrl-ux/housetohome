import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@flipplan/db";
import { clientCreateSchema, clientUpsertByNameSchema } from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";

export const clientRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    prisma.client.findMany({ where: { tenantId: ctx.user.tenantId }, orderBy: { name: "asc" } }),
  ),

  create: protectedProcedure.input(clientCreateSchema).mutation(({ ctx, input }) =>
    prisma.client.create({ data: { ...input, tenantId: ctx.user.tenantId } }),
  ),

  update: protectedProcedure
    .input(clientCreateSchema.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const client = await prisma.client.findUniqueOrThrow({ where: { id } });
      if (client.tenantId !== ctx.user.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
      return prisma.client.update({ where: { id }, data });
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const client = await prisma.client.findUniqueOrThrow({ where: { id: input.id } });
    if (client.tenantId !== ctx.user.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
    await prisma.client.delete({ where: { id: input.id } });
    return { success: true };
  }),

  // Chiamato quando si salvano i "Dati cliente" di un deal (vedi
  // AcquisitionTab): trova per nome (case-insensitive, tenant-scoped) e
  // aggiorna, o crea. Cosi l'agenda clienti si popola da sola.
  upsertByName: protectedProcedure.input(clientUpsertByNameSchema).mutation(async ({ ctx, input }) => {
    const existing = await prisma.client.findFirst({
      where: { tenantId: ctx.user.tenantId, name: { equals: input.name, mode: "insensitive" } },
    });
    if (existing) {
      return prisma.client.update({ where: { id: existing.id }, data: input });
    }
    return prisma.client.create({ data: { ...input, tenantId: ctx.user.tenantId } });
  }),
});
