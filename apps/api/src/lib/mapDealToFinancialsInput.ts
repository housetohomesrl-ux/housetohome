import type { DealFinancialsInput, SaleScenarioType } from "@flipplan/shared";
import type { FullDeal } from "./dealInclude.js";

/**
 * Converte un deal (con tutte le relazioni caricate da Prisma) nell'input
 * del motore di calcolo condiviso. Restituisce null se mancano le sezioni
 * obbligatorie (acquisizione/fiscale/detenzione/ristrutturazione) o lo
 * scenario di vendita richiesto: in quel caso il chiamante deve mostrare
 * "dati incompleti" invece di un numero potenzialmente fuorviante.
 */
export function mapDealToFinancialsInput(
  deal: FullDeal,
  scenarioType: SaleScenarioType,
): DealFinancialsInput | null {
  const { acquisitionDetails, fiscalSettings, renovationSettings, holdingCosts } = deal;
  if (!acquisitionDetails || !fiscalSettings || !renovationSettings || !holdingCosts) {
    return null;
  }
  const saleScenario = deal.saleScenarios.find((s) => s.scenario === scenarioType);
  if (!saleScenario) return null;

  return {
    purchasePrice: acquisitionDetails.purchasePrice.toNumber(),
    contingencyPct: renovationSettings.contingencyPct.toNumber(),
    costLineItems: deal.costLineItems.map((item) => ({
      id: item.id,
      categoryGroup: item.category.group,
      taxableAmount: item.taxableAmount.toNumber(),
      vatRatePct: item.vatRatePct.toNumber(),
      paidAmount: item.paidAmount.toNumber(),
      isMemo: item.isMemo,
      isUnbilled: item.isUnbilled,
    })),
    loans: deal.loans.map((loan) => ({
      id: loan.id,
      type: loan.type,
      principalAmount: loan.principalAmount.toNumber(),
      annualInterestRatePct: loan.annualInterestRatePct.toNumber(),
      durationMonths: loan.durationMonths,
      amortizationType: loan.amortizationType,
      manualPayments: loan.manualPayments.map((p) => ({
        month: p.month,
        principalPortion: p.principalPortion.toNumber(),
        interestPortion: p.interestPortion.toNumber(),
      })),
    })),
    partners: deal.partners.map((p) => ({
      id: p.id,
      contributionAmount: p.contributionAmount.toNumber(),
      profitSharePct: p.profitSharePct.toNumber(),
    })),
    holdingCosts: {
      durationMonths: holdingCosts.durationMonths,
      monthlyInsurance: holdingCosts.monthlyInsurance.toNumber(),
      monthlyUtilities: holdingCosts.monthlyUtilities.toNumber(),
      monthlyPropertyTax: holdingCosts.monthlyPropertyTax.toNumber(),
      monthlyCondoFees: holdingCosts.monthlyCondoFees.toNumber(),
      otherMonthlyCosts: holdingCosts.otherMonthlyCosts.toNumber(),
    },
    fiscalSettings: {
      regimeType: fiscalSettings.regimeType,
      saleSubjectToVat: fiscalSettings.saleSubjectToVat,
      costsVatRecoverable: fiscalSettings.costsVatRecoverable,
      iresRatePct: fiscalSettings.iresRatePct.toNumber(),
      irapRatePct: fiscalSettings.irapRatePct.toNumber(),
      capitalGainsTaxRatePct: fiscalSettings.capitalGainsTaxRatePct.toNumber(),
    },
    saleScenario: {
      scenario: saleScenario.scenario,
      estimatedSalePrice: saleScenario.estimatedSalePrice.toNumber(),
      vatRatePct: saleScenario.vatRatePct.toNumber(),
      agencyFeesSellPct: saleScenario.agencyFeesSellPct.toNumber(),
      marketingStagingCosts: saleScenario.marketingStagingCosts.toNumber(),
      closingCosts: saleScenario.closingCosts.toNumber(),
    },
  };
}
