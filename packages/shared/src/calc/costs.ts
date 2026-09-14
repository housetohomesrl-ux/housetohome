import Decimal from "decimal.js";
import { money, sumMoney, toMoneyNumber, ZERO } from "./money.js";
import { computeVat } from "./vat.js";
import type { CostAggregation, CostCategoryGroup, CostGroupTotals, CostLineItemInput } from "./types.js";

const GROUPS: CostCategoryGroup[] = ["ACQUISIZIONE", "MATERIALI", "LAVORAZIONI", "ENTI_ESTERNI", "ALTRO"];

/**
 * Aggrega le righe di costo (CostLineItem) per categoria.
 *
 * Regole:
 * - Le righe con isMemo=true sono ESCLUSE da ogni totale: servono solo per
 *   tracciabilità (es. materiale già incluso nel preventivo dell'impresa).
 * - Le righe con isUnbilled=true (contanti/non fatturate) SONO incluse nei
 *   totali ma il loro imponibile è riportato anche in `unbilledTaxableTotal`
 *   come sottototale informativo, per trasparenza.
 * - La contingency (RenovationSettings.contingencyPct) si applica
 *   sull'imponibile delle sole categorie LAVORAZIONI + MATERIALI: è il
 *   buffer per imprevisti sull'esecuzione dei lavori e sui materiali, non
 *   sui costi di acquisizione (in gran parte noti/contrattuali) né sugli
 *   oneri di enti esterni (permessi, tecnico).
 */
export function aggregateCostLineItems(items: CostLineItemInput[], contingencyPct: number): CostAggregation {
  const byGroup = {} as Record<CostCategoryGroup, CostGroupTotals>;

  for (const group of GROUPS) {
    const groupItems = items.filter((i) => i.categoryGroup === group && !i.isMemo);
    const taxableTotal = sumMoney(groupItems.map((i) => i.taxableAmount));
    const vatTotal = sumMoney(groupItems.map((i) => computeVat(money(i.taxableAmount), i.vatRatePct).vatAmount));
    const totalWithVat = taxableTotal.plus(vatTotal);
    const paidTotal = sumMoney(groupItems.map((i) => i.paidAmount));
    byGroup[group] = {
      taxableTotal: toMoneyNumber(taxableTotal),
      vatTotal: toMoneyNumber(vatTotal),
      totalWithVat: toMoneyNumber(totalWithVat),
      paidTotal: toMoneyNumber(paidTotal),
      dueTotal: toMoneyNumber(totalWithVat.minus(paidTotal)),
    };
  }

  const nonMemoItems = items.filter((i) => !i.isMemo);
  const nonMemoTaxableTotal = sumMoney(nonMemoItems.map((i) => i.taxableAmount));
  const nonMemoVatTotal = sumMoney(
    nonMemoItems.map((i) => computeVat(money(i.taxableAmount), i.vatRatePct).vatAmount),
  );
  const nonMemoTotalWithVat = nonMemoTaxableTotal.plus(nonMemoVatTotal);
  const nonMemoPaidTotal = sumMoney(nonMemoItems.map((i) => i.paidAmount));

  const contingencyBaseTaxable: Decimal = money(byGroup.LAVORAZIONI.taxableTotal).plus(byGroup.MATERIALI.taxableTotal);
  const contingencyAmount = contingencyBaseTaxable.times(contingencyPct).dividedBy(100);

  const memoTaxableTotal = sumMoney(items.filter((i) => i.isMemo).map((i) => i.taxableAmount));
  const unbilledTaxableTotal = sumMoney(
    items.filter((i) => i.isUnbilled && !i.isMemo).map((i) => i.taxableAmount),
  );

  return {
    byGroup,
    contingencyBaseTaxable: toMoneyNumber(contingencyBaseTaxable),
    contingencyAmount: toMoneyNumber(contingencyAmount),
    memoTaxableTotal: toMoneyNumber(memoTaxableTotal),
    unbilledTaxableTotal: toMoneyNumber(unbilledTaxableTotal),
    nonMemoTaxableTotal: toMoneyNumber(nonMemoTaxableTotal),
    nonMemoVatTotal: toMoneyNumber(nonMemoVatTotal),
    nonMemoTotalWithVat: toMoneyNumber(nonMemoTotalWithVat),
    nonMemoPaidTotal: toMoneyNumber(nonMemoPaidTotal),
    nonMemoDueTotal: toMoneyNumber(nonMemoTotalWithVat.minus(nonMemoPaidTotal)),
  };
}

/** Somma "netta" o "all-in" di un gruppo, secondo la recuperabilità IVA impostata sul deal. */
export function relevantGroupTotal(group: CostGroupTotals, costsVatRecoverable: boolean): Decimal {
  return costsVatRecoverable ? money(group.taxableTotal) : money(group.totalWithVat);
}

export const EMPTY_GROUP_TOTALS: CostGroupTotals = {
  taxableTotal: 0,
  vatTotal: 0,
  totalWithVat: 0,
  paidTotal: 0,
  dueTotal: 0,
};

export { ZERO };
