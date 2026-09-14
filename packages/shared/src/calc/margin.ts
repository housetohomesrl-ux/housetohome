import { money, pctOf, sumMoney, toMoneyNumber, toRatioNumber, ZERO } from "./money.js";
import { aggregateCostLineItems, relevantGroupTotal } from "./costs.js";
import { computeHoldingCosts } from "./holding.js";
import { computeTaxes } from "./fiscal.js";
import { computeBreakevenSalePrice } from "./breakeven.js";
import { computeSourcesAndUses } from "./sourcesAndUses.js";
import type { DealFinancialsInput, DealFinancialsResult } from "./types.js";

/**
 * Funzione principale del motore di calcolo: dato un deal completo, calcola
 * tutti i costi, gli oneri fiscali e le metriche di redditività.
 *
 * Formule chiave (vedi anche i singoli moduli costs.ts / holding.ts /
 * fiscal.ts / breakeven.ts / sourcesAndUses.ts per il dettaglio):
 *
 *   CostoProgettoTotale = CostoAcquisizione + CostoRistrutturazione(+contingency)
 *                         + CostoEntiEsterni + CostoAltro + CostoDetenzione
 *   MargineLordoPreImposte = PrezzoVendita − CostiVendita − CostoProgettoTotale
 *   MargineNetto (Utile Netto) = MargineLordoPreImposte − Imposte
 *   ROI = MargineNetto / CostoProgettoTotale
 *   Cash-on-Cash = MargineNetto / CapitaleProprioInvestito
 *   Cash-on-Cash annualizzato = Cash-on-Cash × (12 / durataMesi)
 */
export function computeDealFinancials(input: DealFinancialsInput): DealFinancialsResult {
  const { fiscalSettings, saleScenario, holdingCosts: holdingConfig } = input;

  const costs = aggregateCostLineItems(input.costLineItems, input.contingencyPct);
  const holding = computeHoldingCosts(holdingConfig, input.loans);

  const recoverable = fiscalSettings.costsVatRecoverable;
  const totalAcquisitionCost = money(input.purchasePrice).plus(
    relevantGroupTotal(costs.byGroup.ACQUISIZIONE, recoverable),
  );
  const totalRenovationCost = relevantGroupTotal(costs.byGroup.LAVORAZIONI, recoverable)
    .plus(relevantGroupTotal(costs.byGroup.MATERIALI, recoverable))
    .plus(costs.contingencyAmount);
  const totalEntiEsterniCost = relevantGroupTotal(costs.byGroup.ENTI_ESTERNI, recoverable);
  const totalAltroCost = relevantGroupTotal(costs.byGroup.ALTRO, recoverable);
  const totalProjectCost = totalAcquisitionCost
    .plus(totalRenovationCost)
    .plus(totalEntiEsterniCost)
    .plus(totalAltroCost)
    .plus(holding.total);

  const salePrice = money(saleScenario.estimatedSalePrice);
  const saleVatAmount = fiscalSettings.saleSubjectToVat ? pctOf(salePrice, saleScenario.vatRatePct) : ZERO;
  const saleCosts = pctOf(salePrice, saleScenario.agencyFeesSellPct)
    .plus(saleScenario.marketingStagingCosts)
    .plus(saleScenario.closingCosts);

  const grossProfitBeforeTax = salePrice.minus(saleCosts).minus(totalProjectCost);

  // Base imponibile plusvalenza (stima): prezzo di vendita meno prezzo di
  // acquisto e costi netti sostenuti (esclusa la contingency, che non è un
  // costo realmente sostenuto ma una stima di budget).
  const capitalGainsBase = salePrice.minus(money(input.purchasePrice).plus(costs.nonMemoTaxableTotal));

  const taxes = computeTaxes(fiscalSettings, {
    grossProfitBeforeTax: toMoneyNumber(grossProfitBeforeTax),
    capitalGainsBase: toMoneyNumber(capitalGainsBase),
  });

  const netProfit = grossProfitBeforeTax.minus(taxes.totalTax);

  const equityInvested = sumMoney(input.partners.map((p) => p.contributionAmount));

  const roi = totalProjectCost.isZero() ? ZERO : netProfit.dividedBy(totalProjectCost);
  const marginOnRevenue = salePrice.isZero() ? ZERO : netProfit.dividedBy(salePrice);
  const cashOnCash = equityInvested.isZero() ? ZERO : netProfit.dividedBy(equityInvested);
  const cashOnCashAnnualized = holdingConfig.durationMonths === 0 ? ZERO : cashOnCash.times(12).dividedBy(holdingConfig.durationMonths);

  const breakevenSalePrice = computeBreakevenSalePrice({
    totalProjectCost: toMoneyNumber(totalProjectCost),
    agencyFeesSellPct: saleScenario.agencyFeesSellPct,
    marketingStagingCosts: saleScenario.marketingStagingCosts,
    closingCosts: saleScenario.closingCosts,
  });

  const vatCredit = recoverable ? money(costs.nonMemoVatTotal) : ZERO;

  const sourcesAndUses = computeSourcesAndUses({
    usesTotal: toMoneyNumber(totalProjectCost),
    equityInvested: toMoneyNumber(equityInvested),
    loans: input.loans,
    loanSchedules: holding.loanSchedules,
    dealDurationMonths: holdingConfig.durationMonths,
    saleProceeds: toMoneyNumber(salePrice),
    saleCosts: toMoneyNumber(saleCosts),
    totalTax: taxes.totalTax,
    remainingUnpaidCosts: costs.nonMemoDueTotal,
    saleVatAmount: toMoneyNumber(saleVatAmount),
    vatCredit: toMoneyNumber(vatCredit),
  });

  return {
    costs,
    holding,
    taxes,
    totals: {
      totalAcquisitionCost: toMoneyNumber(totalAcquisitionCost),
      totalRenovationCost: toMoneyNumber(totalRenovationCost),
      totalEntiEsterniCost: toMoneyNumber(totalEntiEsterniCost),
      totalAltroCost: toMoneyNumber(totalAltroCost),
      totalProjectCost: toMoneyNumber(totalProjectCost),
    },
    sale: {
      saleVatAmount: toMoneyNumber(saleVatAmount),
      saleCosts: toMoneyNumber(saleCosts),
      grossProfitBeforeTax: toMoneyNumber(grossProfitBeforeTax),
      netProfit: toMoneyNumber(netProfit),
    },
    kpis: {
      equityInvested: toMoneyNumber(equityInvested),
      roi: toRatioNumber(roi),
      marginOnCostPct: toRatioNumber(roi.times(100)),
      marginOnRevenuePct: toRatioNumber(marginOnRevenue.times(100)),
      cashOnCash: toRatioNumber(cashOnCash),
      cashOnCashAnnualized: toRatioNumber(cashOnCashAnnualized),
      breakevenSalePrice,
    },
    sourcesAndUses,
  };
}
