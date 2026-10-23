import { prisma, type DealStatus } from "@flipplan/db";
import { computeDealFinancials, type SaleScenarioType } from "@flipplan/shared";
import { mapDealToFinancialsInput } from "./mapDealToFinancialsInput.js";
import { dealInclude, type FullDeal } from "./dealInclude.js";

const CLOSED_STATUSES: DealStatus[] = ["CHIUSO", "ARCHIVIATO"];

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
 * Capitale totale dei finanziamenti aziendali (somma di tutte le quote
 * capitale di tutto il piano di ammortamento, non solo una finestra): è il
 * capitale realmente erogato dalla banca una volta sola, che l'azienda usa
 * per i flip a prescindere da quale sia in corso.
 */
async function computeTotalCompanyLoanPool(tenantId: string): Promise<number> {
  const payments = await prisma.companyLoanPayment.findMany({
    where: { companyLoan: { tenantId } },
    select: { principalPortion: true },
  });
  return payments.reduce((sum, p) => sum + p.principalPortion.toNumber(), 0);
}

/**
 * Costo totale progetto (tutte le spese, non solo acquisto) degli altri
 * flip del tenant ancora "attivi" (non chiusi/archiviati): è il capitale
 * del pool già impegnato su quei flip, da sottrarre al pool totale per
 * sapere quanto resta disponibile per QUESTO flip. Un flip con dati
 * incompleti (manca scenario/sezioni obbligatorie) viene ignorato: non si
 * può stimarne il costo, meglio non bloccare il calcolo per questo deal.
 */
async function computeOtherActiveFlipsCost(tenantId: string, excludeDealId: string): Promise<number> {
  const otherDeals = await prisma.deal.findMany({
    where: {
      tenantId,
      operationType: "FLIP",
      id: { not: excludeDealId },
      status: { notIn: CLOSED_STATUSES },
    },
    include: dealInclude,
  });

  let total = 0;
  for (const otherDeal of otherDeals) {
    const otherInput = mapDealToFinancialsInput(otherDeal, "REALISTICO");
    if (!otherInput) continue;
    const anchorDate = otherDeal.acquisitionDetails?.purchaseDate ?? new Date();
    otherInput.externalFinancingCost = await computeRealFinancingCost(
      tenantId,
      anchorDate,
      otherInput.holdingCosts.durationMonths,
    );
    total += computeDealFinancials(otherInput).totals.totalProjectCost;
  }
  return total;
}

/**
 * Come mapDealToFinancialsInput, ma arricchisce il risultato con il costo
 * reale dei finanziamenti aziendali (CompanyLoan): la rata (capitale +
 * interessi) nella finestra data di acquisto → durata cantiere va nei costi
 * di detenzione; il capitale del pool ancora libero (totale erogato dalla
 * banca meno quanto già impegnato sugli altri flip attivi) va in Fonti e
 * impieghi come fonte di finanziamento automatica — così, valutando un
 * secondo flip, il sistema sa già quanto capitale resta davvero disponibile
 * dopo aver considerato tutte le spese del primo.
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
    const [totalPool, consumedByOthers] = await Promise.all([
      computeTotalCompanyLoanPool(tenantId),
      computeOtherActiveFlipsCost(tenantId, deal.id),
    ]);
    input.externalFinancingPrincipal = Math.max(0, totalPool - consumedByOthers);
  }

  return input;
}
