import { prisma, type DealStatus, type FiscalRegimeType } from "@flipplan/db";
import { computeDealFinancials, type CompanyLoanBreakdown } from "@flipplan/shared";
import { mapDealToFinancialsInput } from "./mapDealToFinancialsInput.js";
import { dealInclude } from "./dealInclude.js";

const CLOSED_STATUSES: DealStatus[] = ["CHIUSO", "ARCHIVIATO"];

interface LoanWithTotal {
  id: string;
  name: string;
  companyOnly: boolean;
  totalPrincipal: number;
  rataCost: number;
  residualToday: number;
}

/**
 * Un finanziamento è idoneo per un flip solo se non è "solo per la società"
 * (companyOnly), oppure se lo è e il flip è fatto con la società (regime
 * SOCIETA_CAPITALI) — es. "Prestito SRL" è erogato alla società, quindi non
 * utilizzabile per un flip fatto da privato, mentre "Mutuo Fabrizio" serve
 * entrambi i regimi.
 */
function isLoanEligible(loan: { companyOnly: boolean }, regimeType: FiscalRegimeType | undefined): boolean {
  if (!loan.companyOnly) return true;
  return regimeType === "SOCIETA_CAPITALI";
}

/**
 * Ripartisce per singolo finanziamento aziendale (Mutuo Fabrizio, Prestito
 * SRL, ecc.) il capitale disponibile per QUESTO flip, tenendo conto di:
 * - idoneità per regime (vedi isLoanEligible);
 * - quanto capitale è già impegnato sugli altri flip ancora attivi (non
 *   chiusi/archiviati), ripartito proporzionalmente tra i finanziamenti
 *   idonei per CIASCUN altro flip (un flip società impegna sia mutuo che
 *   prestito, uno privato solo il mutuo);
 * - il capitale "rientrato" dai flip già chiusi con lo STESSO regime di
 *   questo flip: l'incasso netto (già al netto di imposte/costi/residuo
 *   mutuo) di un flip venduto torna disponibile per i prossimi flip dello
 *   stesso regime, ripartito anch'esso proporzionalmente tra i
 *   finanziamenti idonei per quel regime.
 *
 * Anche la rata (capitale + interessi) nella finestra di questo flip viene
 * calcolata qui, per singolo finanziamento.
 */
export async function computeCompanyLoanBreakdown(
  tenantId: string,
  excludeDealId: string,
  dealRegimeType: FiscalRegimeType | undefined,
  anchorDate: Date,
  durationMonths: number,
): Promise<CompanyLoanBreakdown[]> {
  const loansRaw = await prisma.companyLoan.findMany({
    where: { tenantId },
    include: { payments: true },
    orderBy: { name: "asc" },
  });
  if (loansRaw.length === 0) return [];

  const windowEnd = new Date(anchorDate);
  windowEnd.setMonth(windowEnd.getMonth() + durationMonths);
  const today = new Date();

  const loans: LoanWithTotal[] = loansRaw.map((loan) => ({
    id: loan.id,
    name: loan.name,
    companyOnly: loan.companyOnly,
    totalPrincipal: loan.payments.reduce((sum, p) => sum + p.principalPortion.toNumber(), 0),
    rataCost: loan.payments
      .filter((p) => p.dueDate >= anchorDate && p.dueDate <= windowEnd)
      .reduce((sum, p) => sum + p.principalPortion.toNumber() + p.interestPortion.toNumber(), 0),
    residualToday: Math.max(
      0,
      loan.payments.reduce((sum, p) => sum + p.principalPortion.toNumber(), 0) -
        loan.payments.filter((p) => p.dueDate <= today).reduce((sum, p) => sum + p.principalPortion.toNumber(), 0),
    ),
  }));

  function eligiblePoolTotal(regimeType: FiscalRegimeType | undefined): number {
    return loans.filter((l) => isLoanEligible(l, regimeType)).reduce((sum, l) => sum + l.totalPrincipal, 0);
  }

  // Quanto capitale è impegnato sugli altri flip ancora attivi, ripartito
  // per finanziamento (ognuno proporzionalmente al pool idoneo per IL LORO
  // regime, non quello di questo flip).
  const otherOpenDeals = await prisma.deal.findMany({
    where: { tenantId, operationType: "FLIP", id: { not: excludeDealId }, status: { notIn: CLOSED_STATUSES } },
    include: dealInclude,
  });
  const consumedByLoan = new Map<string, number>(loans.map((l) => [l.id, 0]));
  for (const otherDeal of otherOpenDeals) {
    const otherInput = mapDealToFinancialsInput(otherDeal, "REALISTICO");
    if (!otherInput) continue;
    const otherCost = computeDealFinancials(otherInput).totals.totalProjectCost;
    const otherRegime = otherDeal.fiscalSettings?.regimeType;
    const otherPool = eligiblePoolTotal(otherRegime);
    if (otherPool <= 0) continue;
    for (const loan of loans) {
      if (!isLoanEligible(loan, otherRegime)) continue;
      const share = otherCost * (loan.totalPrincipal / otherPool);
      consumedByLoan.set(loan.id, (consumedByLoan.get(loan.id) ?? 0) + share);
    }
  }

  // Capitale rientrato dai flip già chiusi con lo stesso regime di questo
  // flip: l'incasso netto (al netto di imposte e costi) torna disponibile,
  // ripartito tra i finanziamenti idonei per quel regime.
  const closedSameRegimeDeals = await prisma.deal.findMany({
    where: {
      tenantId,
      operationType: "FLIP",
      id: { not: excludeDealId },
      status: { in: CLOSED_STATUSES },
      fiscalSettings: { regimeType: dealRegimeType },
    },
    include: dealInclude,
  });
  const reinjectedByLoan = new Map<string, number>(loans.map((l) => [l.id, 0]));
  const dealPool = eligiblePoolTotal(dealRegimeType);
  if (dealPool > 0) {
    for (const closedDeal of closedSameRegimeDeals) {
      const closedInput = mapDealToFinancialsInput(closedDeal, "REALISTICO");
      if (!closedInput) continue;
      const netCash = computeDealFinancials(closedInput).sourcesAndUses.finalNetCashToEquity;
      if (netCash <= 0) continue;
      for (const loan of loans) {
        if (!isLoanEligible(loan, dealRegimeType)) continue;
        const share = netCash * (loan.totalPrincipal / dealPool);
        reinjectedByLoan.set(loan.id, (reinjectedByLoan.get(loan.id) ?? 0) + share);
      }
    }
  }

  return loans.map((loan) => {
    const eligible = isLoanEligible(loan, dealRegimeType);
    const poolAvailable = eligible
      ? Math.max(
          0,
          loan.totalPrincipal + (reinjectedByLoan.get(loan.id) ?? 0) - (consumedByLoan.get(loan.id) ?? 0),
        )
      : 0;
    return {
      id: loan.id,
      name: loan.name,
      rataCost: loan.rataCost,
      poolAvailable,
      residualToday: loan.residualToday,
    };
  });
}
