import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { computeVat } from "./vat.js";

describe("computeVat", () => {
  it("22% su 1000 => IVA 220, totale 1220", () => {
    const result = computeVat(new Decimal(1000), 22);
    expect(result.vatAmount.toNumber()).toBe(220);
    expect(result.totalWithVat.toNumber()).toBe(1220);
  });

  it("10% (recupero edilizio agevolato) su 850 => IVA 85, totale 935", () => {
    const result = computeVat(new Decimal(850), 10);
    expect(result.vatAmount.toNumber()).toBe(85);
    expect(result.totalWithVat.toNumber()).toBe(935);
  });

  it("0% (esente/fuori campo) => IVA 0, totale = imponibile", () => {
    const result = computeVat(new Decimal(400), 0);
    expect(result.vatAmount.toNumber()).toBe(0);
    expect(result.totalWithVat.toNumber()).toBe(400);
  });
});
