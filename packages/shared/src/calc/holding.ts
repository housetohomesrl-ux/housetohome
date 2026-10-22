import { money, sumMoney, toMoneyNumber } from "./money.js";
import { computeLoanSchedule } from "./loan.js";
import type { HoldingCostsConfigInput, HoldingCostsResult, LoanInput } from "./types.js";

/**
 * Costi di detenzione (holding costs):
 *   costiFissiMensili = assicurazione + utenze + IMU + condominio + altri
 *   totaleCostiFissi = costiFissiMensili × durataMesi
 *   interessiFinanziamenti = somma degli interessi (quota interessi, MAI la
 *     quota capitale) dei soli finanziamenti del deal (Loan), secondo il
 *     relativo piano di ammortamento (interest-only / francese / manuale)
 *   costoFinanziamentiAziendali = rata intera (capitale + interessi) dei
 *     finanziamenti aziendali sempre attivi (CompanyLoan — mutuo/prestito
 *     soci non legati a un deal specifico), per la finestra di questo deal:
 *     qui si conta tutta la rata, non solo gli interessi, perché è un costo
 *     fisso che l'azienda paga comunque ogni mese
 *   totale = totaleCostiFissi + interessiFinanziamenti + costoFinanziamentiAziendali
 */
export function computeHoldingCosts(
  config: HoldingCostsConfigInput,
  loans: LoanInput[],
  externalFinancingCost = 0,
): HoldingCostsResult {
  const nonLoanMonthlyTotal = sumMoney([
    config.monthlyInsurance,
    config.monthlyUtilities,
    config.monthlyPropertyTax,
    config.monthlyCondoFees,
    config.otherMonthlyCosts,
  ]);
  const nonLoanTotal = nonLoanMonthlyTotal.times(config.durationMonths);

  const loanSchedules = loans.map((loan) => computeLoanSchedule(loan));
  const loanInterestTotal = sumMoney(loanSchedules.map((s) => s.totalInterest));
  const externalFinancingCostMoney = money(externalFinancingCost);

  return {
    nonLoanMonthlyTotal: toMoneyNumber(nonLoanMonthlyTotal),
    nonLoanTotal: toMoneyNumber(nonLoanTotal),
    loanInterestTotal: toMoneyNumber(loanInterestTotal),
    externalFinancingCost: toMoneyNumber(externalFinancingCostMoney),
    total: toMoneyNumber(nonLoanTotal.plus(loanInterestTotal).plus(externalFinancingCostMoney)),
    loanSchedules,
  };
}
