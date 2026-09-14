import Decimal from "decimal.js";
import { money, toMoneyNumber } from "./money.js";

/**
 * Prezzo di pareggio (breakeven): il prezzo di vendita minimo S tale per cui
 * il margine lordo pre-imposte è zero (a quel punto anche le imposte sono
 * zero, perché sia IRES/IRAP sia l'imposta sostitutiva si applicano solo su
 * un utile positivo — quindi il margine netto è anch'esso zero in S).
 *
 * Equazione (S = prezzo di vendita, imponibile):
 *   S − S×%agenzia/100 − marketing − chiusura − CostoProgettoTotale = 0
 *
 * Risolta algebricamente per S:
 *   S × (1 − %agenzia/100) = CostoProgettoTotale + marketing + chiusura
 *   S = (CostoProgettoTotale + marketing + chiusura) / (1 − %agenzia/100)
 *
 * Nota: l'eventuale IVA sulla vendita non entra in questa equazione perché
 * non incide sul margine (è imposta di terzi, versata/compensata a parte).
 */
export function computeBreakevenSalePrice(input: {
  totalProjectCost: number;
  agencyFeesSellPct: number;
  marketingStagingCosts: number;
  closingCosts: number;
}): number {
  const numerator = money(input.totalProjectCost).plus(input.marketingStagingCosts).plus(input.closingCosts);
  const denominator = new Decimal(1).minus(new Decimal(input.agencyFeesSellPct).dividedBy(100));
  if (denominator.lessThanOrEqualTo(0)) {
    return Number.POSITIVE_INFINITY;
  }
  return toMoneyNumber(numerator.dividedBy(denominator));
}
