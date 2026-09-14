import { describe, expect, it } from "vitest";
import { computeTaxes } from "./fiscal.js";
import type { FiscalSettingsInput } from "./types.js";

describe("computeTaxes", () => {
  it("SOCIETA_CAPITALI: applica IRES+IRAP sull'utile lordo positivo", () => {
    const fiscal: FiscalSettingsInput = {
      regimeType: "SOCIETA_CAPITALI",
      saleSubjectToVat: true,
      costsVatRecoverable: true,
      iresRatePct: 24,
      irapRatePct: 3.9,
      capitalGainsTaxRatePct: 26,
    };
    const result = computeTaxes(fiscal, { grossProfitBeforeTax: 50000, capitalGainsBase: 0 });
    expect(result.iresAmount).toBe(12000);
    expect(result.irapAmount).toBe(1950);
    expect(result.totalTax).toBe(13950);
    expect(result.isEstimate).toBe(true);
  });

  it("SOCIETA_CAPITALI: nessuna imposta se l'utile lordo è negativo (perdita)", () => {
    const fiscal: FiscalSettingsInput = {
      regimeType: "SOCIETA_CAPITALI",
      saleSubjectToVat: false,
      costsVatRecoverable: false,
      iresRatePct: 24,
      irapRatePct: 3.9,
      capitalGainsTaxRatePct: 26,
    };
    const result = computeTaxes(fiscal, { grossProfitBeforeTax: -5000, capitalGainsBase: 0 });
    expect(result.totalTax).toBe(0);
  });

  it("PERSONA_FISICA: imposta sostitutiva sulla plusvalenza", () => {
    const fiscal: FiscalSettingsInput = {
      regimeType: "PERSONA_FISICA",
      saleSubjectToVat: false,
      costsVatRecoverable: false,
      iresRatePct: 24,
      irapRatePct: 3.9,
      capitalGainsTaxRatePct: 26,
    };
    const result = computeTaxes(fiscal, { grossProfitBeforeTax: 42980, capitalGainsBase: 63000 });
    expect(result.capitalGainsTaxAmount).toBe(16380);
    expect(result.totalTax).toBe(16380);
  });

  it("ALTRO: nessuna imposta calcolata automaticamente", () => {
    const fiscal: FiscalSettingsInput = {
      regimeType: "ALTRO",
      saleSubjectToVat: false,
      costsVatRecoverable: false,
      iresRatePct: 24,
      irapRatePct: 3.9,
      capitalGainsTaxRatePct: 26,
    };
    const result = computeTaxes(fiscal, { grossProfitBeforeTax: 42980, capitalGainsBase: 63000 });
    expect(result.totalTax).toBe(0);
    expect(result.isEstimate).toBe(false);
  });
});
