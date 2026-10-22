import { prisma } from "@flipplan/db";
import type { SaleScenarioType } from "@flipplan/shared";
import { mapDealToFinancialsInput } from "./mapDealToFinancialsInput.js";
import type { FullDeal } from "./dealInclude.js";

/**
 * Somma la rata intera (capitale + interessi — un costo fisso che l'azienda
 * paga comunque ogni mese, non solo gli interessi) di tutti i CompanyLoan
 * del tenant (finanziamenti aziendali sempre attivi, importati dal piano di
 * ammortamento vero della banca) le cui rate cadono nella finestra
 * [purchaseDate, purchaseDate + durationMonths].
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
 * reale dei finanziamenti aziendali (CompanyLoan), usando la rata vera della
 * banca per la finestra temporale di questo deal invece di stimarla da un
 * tasso teorico. Se il deal ha già una data di acquisto impostata (scheda
 * Acquisizione) si usa quella come inizio finestra; altrimenti (deal ancora
 * in valutazione, business plan) si usa oggi come data di inizio stimata,
 * così il business plan include già la quota capitale + interessi — il
 * valore verrà ricalcolato automaticamente con la finestra vera quando si
 * imposterà la data di acquisto reale.
 */
export async function buildFinancialsInput(tenantId: string, deal: FullDeal, scenarioType: SaleScenarioType) {
  const input = mapDealToFinancialsInput(deal, scenarioType);
  if (!input) return null;
  const anchorDate = deal.acquisitionDetails?.purchaseDate ?? new Date();
  input.externalFinancingCost = await computeRealFinancingCost(tenantId, anchorDate, input.holdingCosts.durationMonths);
  return input;
}
