import Decimal from "decimal.js";
import { money, pctOf, toMoneyNumber, ZERO } from "./money.js";
import type { FiscalSettingsInput, TaxResult } from "./types.js";

/**
 * Imposte sull'operazione. Tre regimi selezionabili per deal (parametrico,
 * non fisso):
 *
 * - SOCIETA_CAPITALI: IRES + IRAP applicate sull'utile lordo pre-imposte
 *     (se positivo). ATTENZIONE: è una STIMA — la base imponibile fiscale
 *     reale può differire per capitalizzazioni, costi indeducibili, perdite
 *     pregresse, ecc. Va sempre verificata con il commercialista
 *     (isEstimate=true, l'interfaccia deve mostrare l'avviso).
 *
 * - PERSONA_FISICA: imposta sostitutiva sulla plusvalenza, calcolata come
 *     (prezzo di vendita imponibile − costo base) × aliquota%, dove il
 *     costo base è prezzo di acquisto + costi netti sostenuti (stima:
 *     l'esatta deducibilità dei costi incrementativi va verificata caso per
 *     caso — anche qui isEstimate=true).
 *
 * - ALTRO: nessuna imposta calcolata automaticamente; l'utente gestisce la
 *     fiscalità fuori dallo strumento (isEstimate=false, totale=0).
 */
export function computeTaxes(
  fiscalSettings: FiscalSettingsInput,
  input: { grossProfitBeforeTax: number; capitalGainsBase: number },
): TaxResult {
  const grossProfit = money(input.grossProfitBeforeTax);

  if (fiscalSettings.regimeType === "SOCIETA_CAPITALI") {
    const taxableProfit = Decimal.max(grossProfit, ZERO);
    const ires = pctOf(taxableProfit, fiscalSettings.iresRatePct);
    const irap = pctOf(taxableProfit, fiscalSettings.irapRatePct);
    return {
      iresAmount: toMoneyNumber(ires),
      irapAmount: toMoneyNumber(irap),
      capitalGainsTaxAmount: 0,
      totalTax: toMoneyNumber(ires.plus(irap)),
      isEstimate: true,
    };
  }

  if (fiscalSettings.regimeType === "PERSONA_FISICA") {
    const taxableGain = Decimal.max(money(input.capitalGainsBase), ZERO);
    const capitalGainsTax = pctOf(taxableGain, fiscalSettings.capitalGainsTaxRatePct);
    return {
      iresAmount: 0,
      irapAmount: 0,
      capitalGainsTaxAmount: toMoneyNumber(capitalGainsTax),
      totalTax: toMoneyNumber(capitalGainsTax),
      isEstimate: true,
    };
  }

  return { iresAmount: 0, irapAmount: 0, capitalGainsTaxAmount: 0, totalTax: 0, isEstimate: false };
}
