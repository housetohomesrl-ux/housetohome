import { z } from "zod";
import { prisma } from "@flipplan/db";
import {
  costLineItemBulkImportSchema,
  costLineItemCreateSchema,
  costLineItemUpdateSchema,
  quoteCreateSchema,
} from "@flipplan/shared";
import { protectedProcedure, router } from "../trpc.js";
import { assertDealAccess } from "../lib/tenantAccess.js";
import { serializeDecimals } from "../lib/serialize.js";

async function assertCostLineItemAccess(tenantId: string, id: string) {
  const item = await prisma.costLineItem.findUniqueOrThrow({ where: { id } });
  await assertDealAccess(tenantId, item.dealId);
  return item;
}

export const costLineItemRouter = router({
  create: protectedProcedure.input(costLineItemCreateSchema).mutation(async ({ ctx, input }) => {
    await assertDealAccess(ctx.user.tenantId, input.dealId);
    const created = await prisma.costLineItem.create({ data: input, include: { category: true } });
    return serializeDecimals(created);
  }),

  update: protectedProcedure.input(costLineItemUpdateSchema).mutation(async ({ ctx, input }) => {
    await assertCostLineItemAccess(ctx.user.tenantId, input.id);
    const { id, ...data } = input;
    const updated = await prisma.costLineItem.update({ where: { id }, data, include: { category: true } });
    return serializeDecimals(updated);
  }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await assertCostLineItemAccess(ctx.user.tenantId, input.id);
    await prisma.costLineItem.delete({ where: { id: input.id } });
    return { success: true };
  }),

  addQuote: protectedProcedure.input(quoteCreateSchema).mutation(async ({ ctx, input }) => {
    await assertCostLineItemAccess(ctx.user.tenantId, input.costLineItemId);
    const quote = await prisma.quote.create({ data: input });
    return serializeDecimals(quote);
  }),

  selectQuote: protectedProcedure
    .input(z.object({ costLineItemId: z.string(), quoteId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await assertCostLineItemAccess(ctx.user.tenantId, input.costLineItemId);
      const updated = await prisma.costLineItem.update({
        where: { id: input.costLineItemId },
        data: { selectedQuoteId: input.quoteId },
      });
      return serializeDecimals(updated);
    }),

  listQuotes: protectedProcedure.input(z.object({ costLineItemId: z.string() })).query(async ({ ctx, input }) => {
    await assertCostLineItemAccess(ctx.user.tenantId, input.costLineItemId);
    const quotes = await prisma.quote.findMany({ where: { costLineItemId: input.costLineItemId }, orderBy: { createdAt: "desc" } });
    return serializeDecimals(quotes);
  }),

  // Import in blocco di voci di costo direttamente in un deal, da un
  // preventivo fornitore caricato dall'utente (vedi apps/web RenovationTab):
  // per ogni riga trova o crea la categoria (tenant-scoped, riusa quella di
  // sistema se il nome combacia) e il fornitore, poi crea la voce di costo.
  // Non tocca la libreria prezzi.
  bulkImport: protectedProcedure.input(costLineItemBulkImportSchema).mutation(async ({ ctx, input }) => {
    const tenantId = ctx.user.tenantId;
    await assertDealAccess(tenantId, input.dealId);

    const existingCategories = await prisma.costCategory.findMany({
      where: { OR: [{ tenantId: null }, { tenantId }] },
    });
    const categoryByName = new Map(existingCategories.map((c) => [c.name, c]));

    const existingVendors = await prisma.vendor.findMany({ where: { tenantId } });
    const vendorByName = new Map(existingVendors.map((v) => [v.name, v]));

    const lastItem = await prisma.costLineItem.findFirst({
      where: { dealId: input.dealId },
      orderBy: { order: "desc" },
    });
    let nextOrder = (lastItem?.order ?? -1) + 1;

    let created = 0;
    let categoriesCreated = 0;
    let vendorsCreated = 0;
    const failed: Array<{ description: string; error: string }> = [];

    for (const row of input.items) {
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
        await prisma.costLineItem.create({
          data: {
            dealId: input.dealId,
            categoryId: category.id,
            description: row.description,
            quantity: row.quantity,
            unit: row.unit,
            taxableAmount: row.taxableAmount,
            vatRatePct: row.vatRatePct ?? (row.categoryGroup === "MATERIALI" ? 22 : 0),
            nonTaxableAmount: row.nonTaxableAmount ?? 0,
            clientPrice: row.clientPrice,
            vendorId,
            notes: row.notes,
            order: nextOrder++,
          },
        });
        created++;
      } catch (err) {
        failed.push({ description: row.description, error: err instanceof Error ? err.message : "errore sconosciuto" });
      }
    }

    return { created, categoriesCreated, vendorsCreated, failed };
  }),

  // Corregge in blocco l'IVA di tutte le voci di costo di un fornitore in un
  // deal (es. dopo un import CSV con l'aliquota sbagliata, per non dover
  // cancellare e reimportare tutto, ne' modificare voce per voce). Non tocca
  // le voci senza fornitore o di altri fornitori.
  bulkUpdateVatByVendor: protectedProcedure
    .input(z.object({ dealId: z.string(), vendorId: z.string(), vatRatePct: z.number().min(0).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await assertDealAccess(ctx.user.tenantId, input.dealId);
      const result = await prisma.costLineItem.updateMany({
        where: { dealId: input.dealId, vendorId: input.vendorId },
        data: { vatRatePct: input.vatRatePct },
      });
      return { updated: result.count };
    }),
});
