import Decimal from "decimal.js";
import { pctOf } from "./money.js";

export interface VatBreakdown {
  taxableAmount: Decimal;
  vatAmount: Decimal;
  totalWithVat: Decimal;
}

/**
 * IVA di una singola riga di costo (o di vendita):
 *   ivaAmount = imponibile × aliquotaIVA% / 100
 *   totaleConIva = imponibile + ivaAmount
 */
export function computeVat(taxableAmount: Decimal, vatRatePct: number): VatBreakdown {
  const vatAmount = pctOf(taxableAmount, vatRatePct);
  return {
    taxableAmount,
    vatAmount,
    totalWithVat: taxableAmount.plus(vatAmount),
  };
}
