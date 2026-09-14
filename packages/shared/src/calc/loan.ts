import Decimal from "decimal.js";
import { money, sumMoney, toMoneyNumber, ZERO } from "./money.js";
import type { LoanInput, LoanScheduleMonth, LoanScheduleResult } from "./types.js";

/**
 * Piano di rimborso "interest-only" (bullet): prassi comune per prestiti
 * ponte a breve termine su operazioni di flip.
 *   interesseMese = capitaleResiduo × tassoAnnuo% / 100 / 12   (capitaleResiduo è costante fino all'ultimo mese)
 *   quotaCapitale = 0 per i mesi 1..N-1, quotaCapitale = capitale residuo interamente all'ultimo mese N
 */
function buildInterestOnlySchedule(principal: Decimal, annualRatePct: number, months: number): LoanScheduleMonth[] {
  const monthlyRate = new Decimal(annualRatePct).dividedBy(100).dividedBy(12);
  const schedule: LoanScheduleMonth[] = [];
  for (let m = 1; m <= months; m++) {
    const interestPortion = principal.times(monthlyRate);
    const principalPortion = m === months ? principal : ZERO;
    const remainingPrincipal = m === months ? ZERO : principal;
    schedule.push({
      month: m,
      principalPortion: toMoneyNumber(principalPortion),
      interestPortion: toMoneyNumber(interestPortion),
      totalPayment: toMoneyNumber(principalPortion.plus(interestPortion)),
      remainingPrincipal: toMoneyNumber(remainingPrincipal),
    });
  }
  return schedule;
}

/**
 * Piano di ammortamento "alla francese" (rata costante):
 *   tassoMensile r = tassoAnnuo% / 100 / 12
 *   rata = P × r / (1 − (1+r)^−N)          (rata = P/N se r = 0)
 *   interesseMese_t = capitaleResiduo_(t−1) × r
 *   quotaCapitale_t = rata − interesseMese_t
 * L'ultima rata assorbe l'eventuale residuo di arrotondamento, così il
 * capitale residuo finale è sempre esattamente zero.
 */
function buildFrenchSchedule(principal: Decimal, annualRatePct: number, months: number): LoanScheduleMonth[] {
  const monthlyRate = new Decimal(annualRatePct).dividedBy(100).dividedBy(12);
  const payment = monthlyRate.isZero()
    ? principal.dividedBy(months)
    : principal
        .times(monthlyRate)
        .dividedBy(new Decimal(1).minus(new Decimal(1).plus(monthlyRate).pow(-months)));

  const schedule: LoanScheduleMonth[] = [];
  let remaining = principal;
  for (let m = 1; m <= months; m++) {
    const interestPortion = remaining.times(monthlyRate);
    let principalPortion = payment.minus(interestPortion);
    if (m === months || principalPortion.greaterThan(remaining)) {
      principalPortion = remaining; // chiude esattamente l'ultima rata
    }
    remaining = remaining.minus(principalPortion);
    schedule.push({
      month: m,
      principalPortion: toMoneyNumber(principalPortion),
      interestPortion: toMoneyNumber(interestPortion),
      totalPayment: toMoneyNumber(principalPortion.plus(interestPortion)),
      remainingPrincipal: toMoneyNumber(remaining),
    });
  }
  return schedule;
}

function buildManualSchedule(loan: LoanInput): LoanScheduleMonth[] {
  const payments = [...(loan.manualPayments ?? [])].sort((a, b) => a.month - b.month);
  let remaining = money(loan.principalAmount);
  return payments.map((p) => {
    remaining = remaining.minus(p.principalPortion);
    return {
      month: p.month,
      principalPortion: p.principalPortion,
      interestPortion: p.interestPortion,
      totalPayment: toMoneyNumber(money(p.principalPortion).plus(p.interestPortion)),
      remainingPrincipal: toMoneyNumber(remaining),
    };
  });
}

export function computeLoanSchedule(loan: LoanInput): LoanScheduleResult {
  const principal = money(loan.principalAmount);
  let schedule: LoanScheduleMonth[];
  switch (loan.amortizationType) {
    case "INTEREST_ONLY":
      schedule = buildInterestOnlySchedule(principal, loan.annualInterestRatePct, loan.durationMonths);
      break;
    case "FRENCH":
      schedule = buildFrenchSchedule(principal, loan.annualInterestRatePct, loan.durationMonths);
      break;
    case "MANUAL":
      schedule = buildManualSchedule(loan);
      break;
  }
  return {
    loanId: loan.id,
    schedule,
    totalInterest: toMoneyNumber(sumMoney(schedule.map((s) => s.interestPortion))),
    totalPrincipal: toMoneyNumber(sumMoney(schedule.map((s) => s.principalPortion))),
  };
}

/** Capitale residuo del prestito ad un dato mese (0 = capitale erogato integralmente, non ancora rimborsato). */
export function remainingPrincipalAtMonth(result: LoanScheduleResult, month: number): number {
  const entry = [...result.schedule].reverse().find((s) => s.month <= month);
  return entry ? entry.remainingPrincipal : result.totalPrincipal;
}
