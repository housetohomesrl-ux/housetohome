import type { FullDeal } from "./dealInclude.js";

type ClientCostLineItem = FullDeal["costLineItems"][number];

/** Stesso ricarico % di default usato nel form "Aggiungi voce" (RenovationTab lato web): solo Materiali/Lavorazioni, resto 0. */
function markupPctForGroup(group: string, deal: FullDeal): number {
  if (group === "MATERIALI") return deal.renovationSettings?.materialMarkupPct.toNumber() ?? 0;
  if (group === "LAVORAZIONI") return deal.renovationSettings?.laborMarkupPct.toNumber() ?? 0;
  return 0;
}

/** Prezzo cliente di una voce (già maggiorato, senza IVA): stessa logica di clientBasePrice lato web. */
function clientBasePrice(item: ClientCostLineItem, deal: FullDeal): number {
  if (item.clientPrice !== null) return item.clientPrice.toNumber();
  const taxable = item.taxableAmount.toNumber();
  return taxable * (1 + markupPctForGroup(item.category.group, deal) / 100);
}

/**
 * Margine lordo e netto (dopo IRES+IRAP) di un deal RISTRUTTURAZIONE_CLIENTE,
 * stessa formula usata in ClientResultsTab lato web: niente ROI/plusvalenza
 * (non c'è acquisto/vendita dell'immobile), solo quanto si guadagna sulla
 * ristrutturazione al netto di IVA, costi di detenzione del cantiere e,
 * per il netto, tasse societarie stimate.
 */
export function computeClientJobSummary(deal: FullDeal): { grossMargin: number; netMargin: number } {
  const items = deal.costLineItems.filter((i) => !i.isMemo);
  let clientSubtotal = 0;
  let marginCost = 0;
  for (const item of items) {
    clientSubtotal += clientBasePrice(item, deal);
    marginCost += item.taxableAmount.toNumber() + item.nonTaxableAmount.toNumber();
  }

  const holdingCosts = deal.holdingCosts;
  const holdingCostsTotal = holdingCosts
    ? holdingCosts.durationMonths * (holdingCosts.monthlyInsurance.toNumber() + holdingCosts.otherMonthlyCosts.toNumber())
    : 0;
  const grossMargin = clientSubtotal - marginCost - holdingCostsTotal;

  const companyTaxRatePct = (deal.fiscalSettings?.iresRatePct.toNumber() ?? 24) + (deal.fiscalSettings?.irapRatePct.toNumber() ?? 3.9);
  const companyTax = grossMargin > 0 ? (grossMargin * companyTaxRatePct) / 100 : 0;
  return { grossMargin, netMargin: grossMargin - companyTax };
}

/**
 * Residuo da incassare dal cliente (preventivo con IVA - acconti+saldo già
 * registrati), stessa formula di ClientResultsTab lato web. Usato per
 * segnalare i deal CONCLUSI con un saldo ancora aperto.
 */
export function computeClientDueBalance(deal: FullDeal): number {
  const items = deal.costLineItems.filter((i) => !i.isMemo);
  const clientSubtotal = items.reduce((sum, item) => sum + clientBasePrice(item, deal), 0);
  const quoteVatRatePct = deal.renovationSettings?.quoteVatRatePct.toNumber() ?? 10;
  const totalClientPrice = clientSubtotal * (1 + quoteVatRatePct / 100);
  const received =
    deal.clientAcconto1Amount.toNumber() +
    deal.clientAcconto2Amount.toNumber() +
    deal.clientAcconto3Amount.toNumber() +
    deal.clientSaldoAmount.toNumber();
  return totalClientPrice - received;
}

/**
 * Rate del cliente (acconto1/2/3/saldo) con una scadenza impostata, passata,
 * e ancora a 0 (nessun importo registrato) — segnalate come in ritardo nel
 * Portafoglio. La scadenza è facoltativa per ogni rata: se non impostata,
 * quella rata non genera mai un avviso.
 */
export function computeOverdueInstallments(deal: FullDeal): Array<{ label: string; dueDate: Date }> {
  const today = new Date();
  const candidates = [
    { label: "Acconto 1", dueDate: deal.clientAcconto1DueDate, amount: deal.clientAcconto1Amount.toNumber() },
    { label: "Acconto 2", dueDate: deal.clientAcconto2DueDate, amount: deal.clientAcconto2Amount.toNumber() },
    { label: "Acconto 3", dueDate: deal.clientAcconto3DueDate, amount: deal.clientAcconto3Amount.toNumber() },
    { label: "Saldo", dueDate: deal.clientSaldoDueDate, amount: deal.clientSaldoAmount.toNumber() },
  ];
  return candidates
    .filter((c) => c.dueDate && c.dueDate < today && c.amount === 0)
    .map((c) => ({ label: c.label, dueDate: c.dueDate as Date }));
}
