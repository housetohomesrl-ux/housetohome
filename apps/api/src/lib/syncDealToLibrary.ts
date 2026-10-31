import { prisma } from "@flipplan/db";
import { TRPCError } from "@trpc/server";

interface DealLibrarySyncRow {
  costLineItemId: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categoryGroup: string;
  vendorId: string | null;
  vendorName: string | null;
  unit: string | null;
  proposedUnitPrice: number;
  action: "none" | "update" | "create";
  matchedPriceListItemId: string | null;
  matchedName: string | null;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Confronta le voci di costo di un deal con la libreria prezzi dello stesso
 * libraryScope, per proporre come allinearla (senza toccarla): la libreria
 * cresce nel tempo con le descrizioni più dettagliate scritte nei deal reali,
 * ma i prezzi NON si confrontano mai qui (possono legittimamente differire
 * da un cantiere all'altro, restano quelli già in libreria).
 *
 * Match per stessa categoria + stesso fornitore (anche "nessun fornitore" su
 * entrambi): se il nome di libreria combacia esattamente con la descrizione
 * del deal, è già allineata (azione "none"); se il nome di libreria è
 * contenuto nella descrizione del deal (o viceversa) è la stessa lavorazione
 * ma descritta in modo diverso/più dettagliato nel deal, si propone di
 * aggiornare il nome di libreria (azione "update"); altrimenti non c'è
 * corrispondenza e si propone di creare una nuova voce (azione "create").
 */
export async function compareDealWithLibrary(
  tenantId: string,
  dealId: string,
): Promise<
  Array<{
    costLineItemId: string;
    description: string;
    categoryId: string;
    categoryName: string;
    categoryGroup: string;
    vendorId: string | null;
    vendorName: string | null;
    unit: string | null;
    proposedUnitPrice: number;
    action: "none" | "update" | "create";
    matchedPriceListItemId: string | null;
    matchedName: string | null;
  }>
> {
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId } });
  if (deal.tenantId !== tenantId) throw new TRPCError({ code: "NOT_FOUND" });

  const items = await prisma.costLineItem.findMany({
    where: { dealId, isMemo: false },
    include: { category: true, vendor: true },
    orderBy: { order: "asc" },
  });

  const libraryItems = await prisma.priceListItem.findMany({
    where: { tenantId, libraryScope: deal.operationType },
  });

  return items.map((item) => {
    const descNorm = normalize(item.description);
    const candidates = libraryItems.filter(
      (lib) => lib.categoryId === item.categoryId && (lib.vendorId ?? null) === (item.vendorId ?? null),
    );

    let match: (typeof libraryItems)[number] | undefined;
    let action: DealLibrarySyncRow["action"] = "create";

    const exact = candidates.find((c) => normalize(c.name) === descNorm);
    if (exact) {
      match = exact;
      action = "none";
    } else {
      const containing = candidates
        .filter((c) => descNorm.includes(normalize(c.name)) || normalize(c.name).includes(descNorm))
        .sort((a, b) => b.name.length - a.name.length)[0];
      if (containing) {
        match = containing;
        action = "update";
      }
    }

    const quantity = item.quantity ? item.quantity.toNumber() : null;
    const taxableAmount = item.taxableAmount.toNumber();
    const proposedUnitPrice = quantity && quantity > 0 ? taxableAmount / quantity : taxableAmount;

    return {
      costLineItemId: item.id,
      description: item.description,
      categoryId: item.categoryId,
      categoryName: item.category.name,
      categoryGroup: item.category.group,
      vendorId: item.vendorId,
      vendorName: item.vendor?.name ?? null,
      unit: item.unit,
      proposedUnitPrice,
      action,
      matchedPriceListItemId: match?.id ?? null,
      matchedName: match?.name ?? null,
    };
  });
}

/** Applica solo le righe selezionate (per id voce di costo) fra quelle proposte da compareDealWithLibrary. */
export async function applyDealLibrarySync(
  tenantId: string,
  dealId: string,
  costLineItemIds: string[],
): Promise<{ updated: number; created: number }> {
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId } });
  if (deal.tenantId !== tenantId) throw new TRPCError({ code: "NOT_FOUND" });

  const rows = await compareDealWithLibrary(tenantId, dealId);
  const selected = rows.filter((r) => costLineItemIds.includes(r.costLineItemId) && r.action !== "none");

  let updated = 0;
  let created = 0;
  for (const row of selected) {
    if (row.action === "update" && row.matchedPriceListItemId) {
      await prisma.priceListItem.update({
        where: { id: row.matchedPriceListItemId },
        data: { name: row.description },
      });
      updated++;
    } else if (row.action === "create") {
      await prisma.priceListItem.create({
        data: {
          tenantId,
          categoryId: row.categoryId,
          name: row.description,
          unit: row.unit,
          unitPrice: row.proposedUnitPrice,
          vendorId: row.vendorId ?? undefined,
          libraryScope: deal.operationType,
        },
      });
      created++;
    }
  }

  return { updated, created };
}
