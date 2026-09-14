import { describe, expect, it } from "vitest";
import { computeLoanSchedule, remainingPrincipalAtMonth } from "./loan.js";
import type { LoanInput } from "./types.js";

describe("computeLoanSchedule - INTEREST_ONLY (bullet)", () => {
  const loan: LoanInput = {
    id: "L1",
    type: "MUTUO_PONTE",
    principalAmount: 100000,
    annualInterestRatePct: 6,
    durationMonths: 6,
    amortizationType: "INTEREST_ONLY",
  };

  it("addebita solo interessi ogni mese (capitale invariato) fino al rimborso integrale nell'ultimo mese", () => {
    const result = computeLoanSchedule(loan);
    // 100000 * 6%/12 = 500/mese
    for (let i = 0; i < 5; i++) {
      const month = result.schedule[i]!;
      expect(month.interestPortion).toBe(500);
      expect(month.principalPortion).toBe(0);
      expect(month.remainingPrincipal).toBe(100000);
    }
    const last = result.schedule[5]!;
    expect(last.interestPortion).toBe(500);
    expect(last.principalPortion).toBe(100000);
    expect(last.remainingPrincipal).toBe(0);

    expect(result.totalInterest).toBe(3000); // 500 * 6
    expect(result.totalPrincipal).toBe(100000);
  });
});

describe("computeLoanSchedule - FRENCH (rata costante)", () => {
  const loan: LoanInput = {
    id: "L2",
    type: "ALTRO",
    principalAmount: 12000,
    annualInterestRatePct: 12,
    durationMonths: 12,
    amortizationType: "FRENCH",
  };

  it("il capitale residuo si azzera esattamente all'ultima rata", () => {
    const result = computeLoanSchedule(loan);
    expect(result.schedule).toHaveLength(12);
    expect(result.schedule[11]!.remainingPrincipal).toBe(0);
    expect(result.totalPrincipal).toBe(12000);
  });

  it("le rate totali sono pressoché costanti (quota capitale crescente, interessi decrescenti)", () => {
    const result = computeLoanSchedule(loan);
    const firstPayment = result.schedule[0]!.totalPayment;
    for (const month of result.schedule) {
      expect(Math.abs(month.totalPayment - firstPayment)).toBeLessThan(1);
    }
    // quota capitale cresce nel tempo, quota interessi decresce
    expect(result.schedule[11]!.principalPortion).toBeGreaterThan(result.schedule[0]!.principalPortion);
    expect(result.schedule[11]!.interestPortion).toBeLessThan(result.schedule[0]!.interestPortion);
  });
});

describe("computeLoanSchedule - MANUAL", () => {
  it("usa esattamente il piano fornito dall'utente", () => {
    const loan: LoanInput = {
      id: "L3",
      type: "ALTRO",
      principalAmount: 5000,
      annualInterestRatePct: 5,
      durationMonths: 2,
      amortizationType: "MANUAL",
      manualPayments: [
        { month: 1, principalPortion: 2000, interestPortion: 100 },
        { month: 2, principalPortion: 3000, interestPortion: 50 },
      ],
    };
    const result = computeLoanSchedule(loan);
    expect(result.totalInterest).toBe(150);
    expect(result.totalPrincipal).toBe(5000);
    expect(result.schedule[1]!.remainingPrincipal).toBe(0);
  });
});

describe("remainingPrincipalAtMonth", () => {
  it("per un prestito interest-only, il capitale resta interamente esposto fino al mese precedente il bullet", () => {
    const loan: LoanInput = {
      id: "L1",
      type: "MUTUO_PONTE",
      principalAmount: 100000,
      annualInterestRatePct: 6,
      durationMonths: 6,
      amortizationType: "INTEREST_ONLY",
    };
    const schedule = computeLoanSchedule(loan);
    expect(remainingPrincipalAtMonth(schedule, 5)).toBe(100000);
  });
});
