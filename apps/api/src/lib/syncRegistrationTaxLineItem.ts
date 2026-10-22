import { prisma } from "@flipplan/db";
import { computeRegistrationTax } from "./registrationTax.js";

const NOTARY_CATEGORY_NAME = "Notaio";

/**
 * Tiene sincronizzata in automatico l'imposta di registro (pagata al
 * notaio insieme al suo onorario) dentro il campo "Importo non imponibile"
 * della riga di costo categoria "Notaio" (scheda Ristrutturazione →
 * Acquisto e spese): l'imponibile di quella riga resta l'onorario vero e
 * proprio del notaio (inserito a mano dall'utente), l'imposta di registro
 * si aggiunge come importo non imponibile (non è soggetta a IVA).
 *
 * Chiamata dopo ogni salvataggio di Dati di acquisizione o Impostazioni
 * fiscali, perché entrambi possono cambiare la base di calcolo. Se il
 * regime fiscale non permette ancora di calcolare un importo (ALTRO, non
 * impostato, o persona fisica senza prima/seconda casa scelta), non tocca
 * nulla: lascia l'eventuale riga esistente come l'ha lasciata l'utente.
 */
export async function syncRegistrationTaxLineItem(dealId: string, tenantId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { acquisitionDetails: true, fiscalSettings: true },
  });
  if (!deal?.acquisitionDetails) return;

  const amount = computeRegistrationTax({
    regimeType: deal.fiscalSettings?.regimeType,
    purchaseCategory: deal.acquisitionDetails.purchaseCategory,
    purchasePrice: deal.acquisitionDetails.purchasePrice.toNumber(),
    renditaCatastale: deal.acquisitionDetails.renditaCatastale?.toNumber() ?? null,
  });
  if (amount === null) return;

  const notaryCategory = await prisma.costCategory.findFirst({
    where: { name: NOTARY_CATEGORY_NAME, group: "ACQUISIZIONE", OR: [{ tenantId: null }, { tenantId }] },
  });
  if (!notaryCategory) return;

  const existing = await prisma.costLineItem.findFirst({
    where: { dealId, categoryId: notaryCategory.id },
    orderBy: { order: "asc" },
  });

  if (existing) {
    await prisma.costLineItem.update({ where: { id: existing.id }, data: { nonTaxableAmount: amount } });
    return;
  }

  const lastItem = await prisma.costLineItem.findFirst({ where: { dealId }, orderBy: { order: "desc" } });
  await prisma.costLineItem.create({
    data: {
      dealId,
      categoryId: notaryCategory.id,
      description: "Notaio",
      taxableAmount: 0,
      vatRatePct: 0,
      nonTaxableAmount: amount,
      order: (lastItem?.order ?? -1) + 1,
    },
  });
}
