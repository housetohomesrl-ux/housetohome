import { money, sumMoney, toMoneyNumber } from "./money.js";
import { remainingPrincipalAtMonth } from "./loan.js";
import type { LoanInput, LoanScheduleResult, SourcesAndUsesResult } from "./types.js";

/**
 * Fonti e Impieghi.
 *
 * Impieghi = costo totale di progetto (all-in o netto secondo recuperabilità IVA).
 * Fonti (pre-vendita) = capitale proprio + capitale erogato dai finanziamenti.
 * Copertura = Fonti − Impieghi. Se negativa, serve capitale aggiuntivo prima
 * dell'incasso da vendita (badge di avviso in UI).
 *
 * Alla vendita, la CASSA NETTA FINALE che torna al capitale proprio è
 * calcolata come movimento di cassa diretto all'evento di vendita (non come
 * identità contabile), per restare tracciabile riga per riga:
 *
 *   + incasso vendita (imponibile)
 *   − costi di vendita (agenzia, marketing/staging, chiusura)
 *   − capitale mutuo/prestito ancora da restituire alla banca/socio
 *   − imposte sull'operazione
 *   − costi ancora da pagare (residuo non saldato sulle righe di costo)
 *   − saldo IVA operazione (IVA a debito sulla vendita meno credito IVA sui
 *     costi, se recuperabile; se negativo è un credito/rimborso e si somma)
 *
 * Per confrontare questo importo con il rendimento sul capitale investito,
 * va messo a confronto con `equitySources` (e con eventuale capitale
 * aggiuntivo versato se la copertura sopra risultasse negativa).
 */
export function computeSourcesAndUses(input: {
  usesTotal: number;
  equityInvested: number;
  loans: LoanInput[];
  loanSchedules: LoanScheduleResult[];
  dealDurationMonths: number;
  saleProceeds: number;
  saleCosts: number;
  totalTax: number;
  remainingUnpaidCosts: number;
  saleVatAmount: number;
  vatCredit: number;
}): SourcesAndUsesResult {
  const loanSources = sumMoney(input.loans.map((l) => l.principalAmount));
  const sourcesTotal = money(input.equityInvested).plus(loanSources);
  const coverage = sourcesTotal.minus(input.usesTotal);

  const loanPrincipalRepaidAtSale = sumMoney(
    input.loanSchedules.map((schedule) => remainingPrincipalAtMonth(schedule, input.dealDurationMonths - 1)),
  );

  const netVatSettlement = money(input.saleVatAmount).minus(input.vatCredit);

  const finalNetCashToEquity = money(input.saleProceeds)
    .minus(input.saleCosts)
    .minus(loanPrincipalRepaidAtSale)
    .minus(input.totalTax)
    .minus(input.remainingUnpaidCosts)
    .minus(netVatSettlement);

  return {
    usesTotal: toMoneyNumber(money(input.usesTotal)),
    equitySources: toMoneyNumber(money(input.equityInvested)),
    loanSources: toMoneyNumber(loanSources),
    sourcesTotal: toMoneyNumber(sourcesTotal),
    coverage: toMoneyNumber(coverage),
    isUndercovered: coverage.lessThan(0),
    saleProceeds: toMoneyNumber(money(input.saleProceeds)),
    loanPrincipalRepaidAtSale: toMoneyNumber(loanPrincipalRepaidAtSale),
    netVatSettlement: toMoneyNumber(netVatSettlement),
    remainingUnpaidCosts: toMoneyNumber(money(input.remainingUnpaidCosts)),
    finalNetCashToEquity: toMoneyNumber(finalNetCashToEquity),
  };
}
