import { prisma } from "@flipplan/db";

/**
 * Allinea la Libreria Flip alla Libreria Ristrutturazioni fino a renderle
 * identiche (stesso set di voci, per nome): la Ristrutturazioni è la fonte
 * aggiornata/corretta (prezzo reale, non maggiorato — la maggiorazione
 * cliente è un'impostazione del deal, non della voce di listino).
 *
 * - Voce presente in Ristrutturazioni ma non in Flip -> creata in Flip.
 * - Voce presente in entrambe (stesso nome) -> aggiornata in Flip con i
 *   dati di Ristrutturazioni (categoria, unità, prezzo, fornitore,
 *   capitolato, quantità di riferimento, note). I flag "Aggiungi a
 *   preventivo/business plan" di una voce Flip già esistente non vengono
 *   toccati, solo impostati di default (dalla fonte) sulle voci nuove.
 * - Voce presente in Flip ma non in Ristrutturazioni -> eliminata da Flip
 *   (le due librerie devono restare uguali). L'eliminazione stacca il
 *   riferimento nelle righe di costo già salvate nei deal (restano con i
 *   loro valori propri, solo senza più il link alla voce di listino) ed
 *   elimina la voce da eventuali pacchetti/template che la includevano.
 *
 * Match per nome voce (stessa convenzione già usata da bulkImport, che non
 * è library-scoped sui nomi).
 */
export async function syncFlipPriceListFromRistrutturazione(tenantId: string) {
  const [sourceItems, flipItems] = await Promise.all([
    prisma.priceListItem.findMany({ where: { tenantId, libraryScope: "RISTRUTTURAZIONE_CLIENTE" } }),
    prisma.priceListItem.findMany({ where: { tenantId, libraryScope: "FLIP" } }),
  ]);
  const sourceByName = new Map(sourceItems.map((i) => [i.name, i]));
  const flipByName = new Map(flipItems.map((i) => [i.name, i]));

  const createdNames: string[] = [];
  const updatedDetails: Array<{ name: string; oldPrice: number; newPrice: number; suspicious: boolean }> = [];
  const deletedNames: string[] = [];
  let unchanged = 0;

  for (const source of sourceItems) {
    const existing = flipByName.get(source.name);
    if (!existing) {
      await prisma.priceListItem.create({
        data: {
          tenantId,
          categoryId: source.categoryId,
          name: source.name,
          unit: source.unit,
          unitPrice: source.unitPrice,
          vendorId: source.vendorId,
          specification: source.specification,
          referenceQuantity: source.referenceQuantity,
          notes: source.notes,
          includeInPreventivo: source.includeInPreventivo,
          includeInBusinessPlan: source.includeInBusinessPlan,
          libraryScope: "FLIP",
        },
      });
      createdNames.push(source.name);
      continue;
    }

    const changed =
      !existing.unitPrice.equals(source.unitPrice) ||
      existing.categoryId !== source.categoryId ||
      (existing.unit ?? null) !== (source.unit ?? null) ||
      (existing.vendorId ?? null) !== (source.vendorId ?? null) ||
      (existing.specification ?? null) !== (source.specification ?? null) ||
      (existing.referenceQuantity ?? null) !== (source.referenceQuantity ?? null) ||
      (existing.notes ?? null) !== (source.notes ?? null);

    if (!changed) {
      unchanged++;
      continue;
    }

    const oldPrice = existing.unitPrice.toNumber();
    const newPrice = source.unitPrice.toNumber();
    // Segnala come "sospetta" una differenza di prezzo grande (>50%, o un
    // prezzo che passa da/a zero), cosi chi lancia la sincronizzazione puo
    // verificarla invece di scoprirla solo dopo su un deal.
    const suspicious =
      oldPrice !== newPrice && (oldPrice === 0 || newPrice === 0 || Math.abs(newPrice - oldPrice) / oldPrice > 0.5);

    updatedDetails.push({ name: source.name, oldPrice, newPrice, suspicious });
    await prisma.priceListItem.update({
      where: { id: existing.id },
      data: {
        categoryId: source.categoryId,
        unit: source.unit,
        unitPrice: source.unitPrice,
        vendorId: source.vendorId,
        specification: source.specification,
        referenceQuantity: source.referenceQuantity,
        notes: source.notes,
      },
    });
  }

  for (const flip of flipItems) {
    if (!sourceByName.has(flip.name)) {
      await prisma.priceListItem.delete({ where: { id: flip.id } });
      deletedNames.push(flip.name);
    }
  }

  return {
    sourceCount: sourceItems.length,
    created: createdNames.length,
    createdNames,
    updated: updatedDetails.length,
    updatedDetails,
    deleted: deletedNames.length,
    deletedNames,
    unchanged,
  };
}
