import { money, sumMoney, toMoneyNumber } from "./money.js";
import { computeLoanSchedule } from "./loan.js";
import type { HoldingCostsConfigInput, HoldingCostsResult, LoanInput } from "./types.js";

/**
 * Costi di detenzione (holding costs):
 *   costiFissiMensili = assicurazione + utenze + IMU + condominio + altri
 *   totaleCostiFissi = costiFissiMensili × durataMesi
 *   interessiFinanziamenti = somma degli interessi (quota interessi, MAI la
 *     quota capitale) di tutti i finanziamenti del deal, secondo il relativo
 *     piano di ammortamento (interest-only / francese / manuale)
 *   totale = totaleCostiFissi + interessiFinanziamenti
 */
export function computeHoldingCosts(config: HoldingCostsConfigInput, loans: LoanInput[]): HoldingCostsResult {
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

  return {
    nonLoanMonthlyTotal: toMoneyNumber(nonLoanMonthlyTotal),
    nonLoanTotal: toMoneyNumber(nonLoanTotal),
    loanInterestTotal: toMoneyNumber(loanInterestTotal),
    total: toMoneyNumber(nonLoanTotal.plus(loanInterestTotal)),
    loanSchedules,
  };
}
