import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@flipplan/db";
import { priceListBulkImportSchema, priceListItemCreateSchema } from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";
import { serializeDecimals } from "../lib/serialize.js";

export const priceListItemRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const items = await prisma.priceListItem.findMany({
      where: { tenantId: ctx.user.tenantId },
      include: { category: true, vendor: true },
      orderBy: { name: "asc" },
    });
    return serializeDecimals(items);
  }),

  create: protectedProcedure.input(priceListItemCreateSchema).mutation(async ({ ctx, input }) => {
    const created = await prisma.priceListItem.create({
      data: { ...input, tenantId: ctx.user.tenantId },
      include: { category: true, vendor: true },
    });
    return serializeDecimals(created);
  }),

  update: protectedProcedure
    .input(priceListItemCreateSchema.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const item = await prisma.priceListItem.findUniqueOrThrow({ where: { id } });
      if (item.tenantId !== ctx.user.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = await prisma.priceListItem.update({ where: { id }, data, include: { category: true, vendor: true } });
      return serializeDecimals(updated);
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const item = await prisma.priceListItem.findUniqueOrThrow({ where: { id: input.id } });
    if (item.tenantId !== ctx.user.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
    await prisma.priceListItem.delete({ where: { id: input.id } });
    return { success: true };
  }),

  // Import in blocco da CSV (vedi apps/web PriceListPage): per ogni riga trova o
  // crea la categoria (tenant-scoped, riusa quella di sistema se il nome combacia),
  // poi crea la voce di listino. Salta le voci con un nome già presente per il
  // tenant, per poter re-importare lo stesso file senza duplicare nulla.
  bulkImport: protectedProcedure.input(priceListBulkImportSchema).mutation(async ({ ctx, input }) => {
    const tenantId = ctx.user.tenantId;

    const existingCategories = await prisma.costCategory.findMany({
      where: { OR: [{ tenantId: null }, { tenantId }] },
    });
    const categoryByName = new Map(existingCategories.map((c) => [c.name, c]));

    const existingVendors = await prisma.vendor.findMany({ where: { tenantId } });
    const vendorByName = new Map(existingVendors.map((v) => [v.name, v]));

    const existingItems = await prisma.priceListItem.findMany({ where: { tenantId }, select: { name: true } });
    const existingNames = new Set(existingItems.map((i) => i.name));

    let created = 0;
    let skipped = 0;
    let categoriesCreated = 0;
    let vendorsCreated = 0;
    const failed: Array<{ name: string; error: string }> = [];

    for (const row of input.items) {
      if (existingNames.has(row.name)) {
        skipped++;
        continue;
      }
      try {
        let category = categoryByName.get(row.categoryName);
        if (!category) {
          category = await prisma.costCategory.create({
            data: { tenantId, group: row.categoryGroup, name: row.categoryName, order: 50 },
          });
          categoryByName.set(row.categoryName, category);
          categoriesCreated++;
        }
        let vendorId: string | undefined;
        if (row.vendorName) {
          let vendor = vendorByName.get(row.vendorName);
          if (!vendor) {
            vendor = await prisma.vendor.create({ data: { tenantId, name: row.vendorName } });
            vendorByName.set(row.vendorName, vendor);
            vendorsCreated++;
          }
          vendorId = vendor.id;
        }
        await prisma.priceListItem.create({
          data: {
            tenantId,
            categoryId: category.id,
            name: row.name,
            unit: row.unit,
            unitPrice: row.unitPrice,
            vendorId,
            specification: row.specification,
            referenceQuantity: row.referenceQuantity,
            notes: row.notes,
            includeInPreventivo: row.includeInPreventivo ?? true,
            includeInBusinessPlan: row.includeInBusinessPlan ?? false,
          },
        });
        existingNames.add(row.name);
        created++;
      } catch (err) {
        failed.push({ name: row.name, error: err instanceof Error ? err.message : "errore sconosciuto" });
      }
    }

    return { created, skipped, categoriesCreated, vendorsCreated, failed };
  }),
});
