import { prisma } from "@flipplan/db";
import type { SaleScenarioType } from "@flipplan/shared";
import { mapDealToFinancialsInput } from "./mapDealToFinancialsInput.js";
import { computeCompanyLoanBreakdown } from "./companyLoanBreakdown.js";
import type { FullDeal } from "./dealInclude.js";

/**
 * Somma la rata intera (capitale + interessi — un costo fisso che l'azienda
 * paga comunque ogni mese, non solo gli interessi) di tutti i CompanyLoan
 * del tenant (finanziamenti aziendali sempre attivi, importati dal piano di
 * ammortamento vero della banca) le cui rate cadono nella finestra
 * [purchaseDate, purchaseDate + durationMonths]. Va nei costi di detenzione.
 */
async function computeRealFinancingCost(tenantId: string, purchaseDate: Date, durationMonths: number): Promise<number> {
  const endDate = new Date(purchaseDate);
  endDate.setMonth(endDate.getMonth() + durationMonths);
  const payments = await prisma.companyLoanPayment.findMany({
    where: { companyLoan: { tenantId }, dueDate: { gte: purchaseDate, lte: endDate } },
    select: { principalPortion: true, interestPortion: true },
  });
  return payments.reduce((sum, p) => sum + p.principalPortion.toNumber() + p.interestPortion.toNumber(), 0);
}

/**
 * Come mapDealToFinancialsInput, ma arricchisce il risultato con il costo
 * reale dei finanziamenti aziendali (CompanyLoan): la rata (capitale +
 * interessi) nella finestra data di acquisto → durata cantiere va nei costi
 * di detenzione; il capitale ancora disponibile (vedi companyLoanBreakdown.ts
 * per idoneità per regime e capitale rientrato dai flip già venduti) va in
 * Fonti e impieghi come fonte di finanziamento automatica — stessa funzione
 * usata per il dettaglio per singolo finanziamento in scheda Risultati, così
 * il totale qui e il dettaglio restano sempre coerenti.
 *
 * Se il deal ha già una data di acquisto impostata (scheda Acquisizione) si
 * usa quella come inizio finestra per la rata; altrimenti (deal ancora in
 * valutazione, business plan) si usa oggi come data di inizio stimata.
 */
export async function buildFinancialsInput(tenantId: string, deal: FullDeal, scenarioType: SaleScenarioType) {
  const input = mapDealToFinancialsInput(deal, scenarioType);
  if (!input) return null;
  const anchorDate = deal.acquisitionDetails?.purchaseDate ?? new Date();
  input.externalFinancingCost = await computeRealFinancingCost(tenantId, anchorDate, input.holdingCosts.durationMonths);

  if (deal.operationType === "FLIP") {
    const breakdown = await computeCompanyLoanBreakdown(
      tenantId,
      deal.id,
      deal.fiscalSettings?.regimeType,
      anchorDate,
      input.holdingCosts.durationMonths,
    );
    input.externalFinancingPrincipal = breakdown.reduce((sum, loan) => sum + loan.poolAvailable, 0);
  }

  return input;
}
