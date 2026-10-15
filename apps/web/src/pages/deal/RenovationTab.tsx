import { useEffect, useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatCurrency } from "../../lib/format";
import type { DealDetail, CostLineItemDetail, CostCategory, PriceListItem, Vendor } from "../../lib/types";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Input, Label, Select } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";

const GROUP_LABEL: Record<string, string> = {
  ACQUISIZIONE: "Acquisto e spese",
  MATERIALI: "Materiali",
  LAVORAZIONI: "Lavorazioni",
  ENTI_ESTERNI: "Enti esterni",
  ALTRO: "Altro / varie",
};

const STATUS_LABEL: Record<string, string> = { DA_FARE: "Da fare", IN_CORSO: "In corso", COMPLETATO: "Completato" };

function rowTotals(item: CostLineItemDetail) {
  const taxable = item.taxableAmount;
  const vat = (taxable * item.vatRatePct) / 100;
  const total = taxable + vat + item.nonTaxableAmount;
  const due = total - item.paidAmount;
  return { vat, total, due };
}

function markupPctForGroup(group: string, deal: DealDetail): number {
  if (group === "MATERIALI") return deal.renovationSettings?.materialMarkupPct ?? 0;
  if (group === "LAVORAZIONI") return deal.renovationSettings?.laborMarkupPct ?? 0;
  return 0;
}

/** Prezzo cliente di default quando la voce non ne ha uno impostato a mano: costo + ricarico % per gruppo (solo Materiali/Lavorazioni). */
export function autoClientPrice(item: CostLineItemDetail, deal: DealDetail): number {
  return item.taxableAmount * (1 + markupPctForGroup(item.category.group, deal) / 100);
}

/**
 * Prezzo finale da far pagare al cliente per una voce: prezzo cliente (già
 * maggiorato) + IVA, solo per i Materiali (l'IVA che paghiamo noi sui
 * materiali viene rigirata al cliente). Le Lavorazioni e le altre voci non
 * hanno IVA aggiunta in più sul preventivo.
 */
export function clientFinalPrice(item: CostLineItemDetail, deal: DealDetail): number {
  const price = item.clientPrice ?? autoClientPrice(item, deal);
  const vat = item.category.group === "MATERIALI" ? (price * item.vatRatePct) / 100 : 0;
  return price + vat;
}

/** Come autoClientPrice, ma a partire da un imponibile non ancora salvato (form "Aggiungi voce"). */
function computeGroupClientPrice(group: string, taxableAmount: number, deal: DealDetail): number {
  return taxableAmount * (1 + markupPctForGroup(group, deal) / 100);
}

const EMPTY_NEW_ITEM = {
  categoryId: "",
  description: "",
  quantity: "1",
  taxableAmount: "0",
  vatRatePct: "22",
  nonTaxableAmount: "0",
  clientPrice: "",
  isMemo: false,
  isUnbilled: false,
  priceListItemId: "" as string | null,
  vendorId: "" as string | null,
};

export default function RenovationTab({ deal }: { deal: DealDetail }) {
  const utils = trpc.useUtils();
  const categories = trpc.costCategory.list.useQuery();
  const priceList = trpc.priceListItem.list.useQuery();
  const vendors = trpc.vendor.list.useQuery();
  const [contingencyPct, setContingencyPct] = useState(deal.renovationSettings?.contingencyPct.toString() ?? "12");
  const [materialMarkupPct, setMaterialMarkupPct] = useState(deal.renovationSettings?.materialMarkupPct?.toString() ?? "0");
  const [laborMarkupPct, setLaborMarkupPct] = useState(deal.renovationSettings?.laborMarkupPct?.toString() ?? "0");
  const [editingItem, setEditingItem] = useState<CostLineItemDetail | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const saveContingency = trpc.dealSettings.updateRenovationSettings.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });
  const saveMarkup = trpc.dealSettings.updateRenovationSettings.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });
  const updateItem = trpc.costLineItem.update.useMutation({ onSuccess: () => utils.deal.get.invalidate({ id: deal.id }) });
  const deleteItem = trpc.costLineItem.delete.useMutation({ onSuccess: () => utils.deal.get.invalidate({ id: deal.id }) });
  const isClientJob = deal.operationType === "RISTRUTTURAZIONE_CLIENTE";

  // Ogni voce può avere un prezzo cliente impostato a mano: quando è il caso
  // (es. quasi tutte, impostato in automatico alla creazione), cambiare il
  // ricarico % qui sopra non lo aggiorna più da solo. Questo pulsante lo
  // riporta al calcolo automatico (costo + ricarico attuale) per tutte le
  // voci, cosi il preventivo riflette subito la nuova percentuale.
  async function recalculateClientPrices() {
    const toReset = deal.costLineItems.filter(
      (item) => (item.category.group === "MATERIALI" || item.category.group === "LAVORAZIONI") && item.clientPrice !== null,
    );
    if (toReset.length === 0) return;
    setRecalculating(true);
    try {
      await Promise.all(toReset.map((item) => updateItem.mutateAsync({ id: item.id, clientPrice: null })));
    } finally {
      setRecalculating(false);
    }
  }

  const byGroup: Record<string, CostLineItemDetail[]> = {};
  for (const item of deal.costLineItems) {
    const group = item.category.group;
    (byGroup[group] ??= []).push(item);
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader
          title="Contingency / imprevisti"
          subtitle="Applicata automaticamente su Lavorazioni + Materiali nel calcolo del costo totale."
        />
        <CardBody className="flex items-end gap-3">
          <div>
            <Label htmlFor="contingency">Percentuale (%)</Label>
            <Input
              id="contingency"
              type="number"
              className="w-32"
              value={contingencyPct}
              onChange={(e) => setContingencyPct(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => saveContingency.mutate({ dealId: deal.id, contingencyPct: Number(contingencyPct) })}
            disabled={saveContingency.isPending}
          >
            Salva
          </Button>
        </CardBody>
      </Card>

      {isClientJob && (
        <Card>
          <CardHeader
            title="Ricarico per il preventivo cliente"
            subtitle="Determina in automatico il prezzo cliente delle voci di Materiali e Lavorazioni (costo + ricarico), se una voce non ha un prezzo cliente impostato a mano."
          />
          <CardBody className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="materialMarkup">Ricarico Materiali (%)</Label>
              <Input
                id="materialMarkup"
                type="number"
                className="w-32"
                value={materialMarkupPct}
                onChange={(e) => setMaterialMarkupPct(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="laborMarkup">Ricarico Lavorazioni (%)</Label>
              <Input
                id="laborMarkup"
                type="number"
                className="w-32"
                value={laborMarkupPct}
                onChange={(e) => setLaborMarkupPct(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                saveMarkup.mutate({
                  dealId: deal.id,
                  contingencyPct: Number(contingencyPct),
                  materialMarkupPct: Number(materialMarkupPct),
                  laborMarkupPct: Number(laborMarkupPct),
                })
              }
              disabled={saveMarkup.isPending}
            >
              Salva
            </Button>
            <button
              type="button"
              className="text-sm text-brand-700 hover:underline disabled:opacity-50"
              onClick={recalculateClientPrices}
              disabled={recalculating}
            >
              {recalculating ? "Ricalcolo..." : "Ricalcola i prezzi cliente già impostati con il ricarico attuale"}
            </button>
          </CardBody>
        </Card>
      )}

      {Object.entries(GROUP_LABEL)
        .filter(([group]) => !(isClientJob && group === "ACQUISIZIONE"))
        .map(([group, label]) => {
        const items = byGroup[group] ?? [];
        const groupCategories = categories.data?.filter((c) => c.group === group) ?? [];
        return (
          <Card key={group}>
            <CardHeader title={label} />
            <CardBody>
              {items.length > 0 && (
                <div className="mb-4 overflow-x-auto">
                  <table className={`w-full table-fixed text-sm ${isClientJob ? "min-w-[1020px]" : "min-w-[920px]"}`}>
                    <colgroup>
                      <col className={isClientJob ? "w-[18%]" : "w-[22%]"} />
                      <col className={isClientJob ? "w-[10%]" : "w-[12%]"} />
                      <col className={isClientJob ? "w-[8%]" : "w-[9%]"} />
                      <col className={isClientJob ? "w-[5%]" : "w-[6%]"} />
                      <col className={isClientJob ? "w-[8%]" : "w-[9%]"} />
                      {isClientJob && <col className="w-[10%]" />}
                      <col className={isClientJob ? "w-[12%]" : "w-[14%]"} />
                      <col className={isClientJob ? "w-[8%]" : "w-[9%]"} />
                      <col className={isClientJob ? "w-[11%]" : "w-[12%]"} />
                      <col className={isClientJob ? "w-[7%]" : "w-[7%]"} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                        <th className="py-2 pr-2">Descrizione</th>
                        <th className="py-2 pr-2">Categoria</th>
                        <th className="py-2 pr-2 text-right">Imponibile</th>
                        <th className="py-2 pr-2 text-right">IVA%</th>
                        <th className="py-2 pr-2 text-right">Totale</th>
                        {isClientJob && <th className="py-2 pr-2 text-right">Prezzo cliente</th>}
                        <th className="py-2 pr-2 text-right">Pagato</th>
                        <th className="py-2 pr-2 text-right">Residuo</th>
                        <th className="py-2 pr-2">Stato</th>
                        <th className="py-2 pr-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <CostLineItemRow
                          key={item.id}
                          item={item}
                          deal={deal}
                          updateItem={updateItem}
                          deleteItem={deleteItem}
                          onEdit={() => setEditingItem(item)}
                          isClientJob={isClientJob}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <AddCostItemForm
                dealId={deal.id}
                deal={deal}
                group={group}
                label={label}
                groupCategories={groupCategories}
                priceListData={priceList.data}
                vendors={vendors.data}
                updateItem={updateItem}
                editingItem={editingItem?.category.group === group ? editingItem : null}
                onCancelEdit={() => setEditingItem(null)}
                isClientJob={isClientJob}
              />
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Riga della tabella di una voce di costo. "Stato" (avanzamento lavori) e
 * "Pagato" (quanto è stato effettivamente versato) sono campi indipendenti:
 * segnare una voce come Completato NON la marca automaticamente come pagata.
 */
function CostLineItemRow({
  item,
  deal,
  updateItem,
  deleteItem,
  onEdit,
  isClientJob,
}: {
  item: CostLineItemDetail;
  deal: DealDetail;
  updateItem: ReturnType<typeof trpc.costLineItem.update.useMutation>;
  deleteItem: ReturnType<typeof trpc.costLineItem.delete.useMutation>;
  onEdit: () => void;
  isClientJob: boolean;
}) {
  const totals = rowTotals(item);
  const [paidAmount, setPaidAmount] = useState(item.paidAmount.toString());
  const [clientPrice, setClientPrice] = useState(item.clientPrice?.toString() ?? "");

  function commitPaidAmount() {
    const value = Number(paidAmount);
    if (!Number.isNaN(value) && value !== item.paidAmount) {
      updateItem.mutate({ id: item.id, paidAmount: value });
    }
  }

  function commitClientPrice() {
    const value = clientPrice === "" ? null : Number(clientPrice);
    if (value === null || !Number.isNaN(value)) {
      if (value !== (item.clientPrice ?? null)) {
        updateItem.mutate({ id: item.id, clientPrice: value });
      }
    }
  }

  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pr-2 align-top">
        <div className="break-words">{item.description}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {item.isMemo && <Badge tone="neutral">memo</Badge>}
          {item.isUnbilled && <Badge tone="warning">contanti/non fatt.</Badge>}
          {item.nonTaxableAmount > 0 && (
            <Badge tone="info">+{formatCurrency(item.nonTaxableAmount, true)} f.c. IVA</Badge>
          )}
        </div>
      </td>
      <td className="py-2 pr-2 align-top text-slate-500">
        {item.category.name}
        {item.vendor && <div className="text-xs text-slate-400">{item.vendor.name}</div>}
      </td>
      <td className="py-2 pr-2 align-top text-right">{formatCurrency(item.taxableAmount, true)}</td>
      <td className="py-2 pr-2 align-top text-right">{item.vatRatePct}%</td>
      <td className="py-2 pr-2 align-top text-right font-medium">{formatCurrency(totals.total, true)}</td>
      {isClientJob && (
        <td className="py-2 pr-2 align-top text-right">
          <Input
            type="number"
            className="w-full py-1 text-right text-xs"
            placeholder={autoClientPrice(item, deal).toFixed(2)}
            value={clientPrice}
            onChange={(e) => setClientPrice(e.target.value)}
            onBlur={commitClientPrice}
          />
        </td>
      )}
      <td className="py-2 pr-2 align-top text-right">
        <Input
          type="number"
          className="w-full py-1 text-right text-xs"
          value={paidAmount}
          onChange={(e) => setPaidAmount(e.target.value)}
          onBlur={commitPaidAmount}
        />
        {!isClientJob && (
          <button
            className="mt-1 whitespace-nowrap text-[11px] text-brand-600 hover:underline"
            onClick={() => {
              setPaidAmount(totals.total.toString());
              if (totals.total !== item.paidAmount) updateItem.mutate({ id: item.id, paidAmount: totals.total });
            }}
          >
            Segna come pagato
          </button>
        )}
      </td>
      <td className="py-2 pr-2 align-top text-right">{formatCurrency(totals.due, true)}</td>
      <td className="py-2 pr-2 align-top">
        <Select
          className="w-full py-1 text-xs"
          value={item.status}
          onChange={(e) => updateItem.mutate({ id: item.id, status: e.target.value as CostLineItemDetail["status"] })}
        >
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </td>
      <td className="py-2 pr-2 align-top text-right">
        <button
          className="block text-xs text-red-500 hover:underline"
          onClick={() => deleteItem.mutate({ id: item.id })}
        >
          Elimina
        </button>
        <button className="mt-1 block text-xs text-brand-600 hover:underline" onClick={onEdit}>
          Modifica
        </button>
      </td>
    </tr>
  );
}

/**
 * Form "+ Aggiungi voce" per un singolo gruppo. Istanziato una volta per
 * gruppo dentro RenovationTab: ogni istanza ha il proprio stato locale,
 * così compilare la voce in una sezione (es. Materiali) non si riflette
 * anche nelle altre sezioni (es. Acquisto e spese).
 */
function AddCostItemForm({
  dealId,
  deal,
  group,
  label,
  groupCategories,
  priceListData,
  vendors,
  updateItem,
  editingItem,
  onCancelEdit,
  isClientJob,
}: {
  dealId: string;
  deal: DealDetail;
  group: string;
  label: string;
  groupCategories: CostCategory[];
  priceListData: PriceListItem[] | undefined;
  vendors: Vendor[] | undefined;
  updateItem: ReturnType<typeof trpc.costLineItem.update.useMutation>;
  editingItem: CostLineItemDetail | null;
  onCancelEdit: () => void;
  isClientJob: boolean;
}) {
  const utils = trpc.useUtils();
  const [newItem, setNewItem] = useState(EMPTY_NEW_ITEM);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const selectedPriceListItem = priceListData?.find((p) => p.id === newItem.priceListItemId) ?? null;
  const categoryPriceList = newItem.categoryId
    ? (priceListData ?? []).filter(
        (p) => p.categoryId === newItem.categoryId && p.includeInPreventivo && p.libraryScope === deal.operationType,
      )
    : [];

  const createItem = trpc.costLineItem.create.useMutation({
    onSuccess: () => {
      utils.deal.get.invalidate({ id: dealId });
      setNewItem(EMPTY_NEW_ITEM);
    },
  });

  useEffect(() => {
    if (!editingItem) return;
    setNewItem({
      categoryId: editingItem.categoryId,
      description: editingItem.description,
      quantity: "1",
      taxableAmount: editingItem.taxableAmount.toString(),
      vatRatePct: editingItem.vatRatePct.toString(),
      nonTaxableAmount: editingItem.nonTaxableAmount.toString(),
      clientPrice: editingItem.clientPrice?.toString() ?? "",
      isMemo: editingItem.isMemo,
      isUnbilled: editingItem.isUnbilled,
      priceListItemId: editingItem.priceListItemId ?? null,
      vendorId: editingItem.vendorId ?? null,
    });
    setDetailsOpen(true);
  }, [editingItem]);

  function cancelEdit() {
    setNewItem(EMPTY_NEW_ITEM);
    onCancelEdit();
  }

  return (
    <details
      className="rounded-md border border-dashed border-slate-300 p-3"
      open={detailsOpen}
      onToggle={(e) => setDetailsOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-medium text-brand-700">
        {editingItem ? `Modifica voce di "${label}"` : `+ Aggiungi voce a "${label}"`}
      </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label>Categoria</Label>
          <Select
            value={newItem.categoryId}
            onChange={(e) =>
              setNewItem({
                ...newItem,
                categoryId: e.target.value,
                priceListItemId: null,
                description: "",
                quantity: "1",
                taxableAmount: "0",
                nonTaxableAmount: "0",
                clientPrice: "",
              })
            }
          >
            <option value="">Seleziona...</option>
            {groupCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Voce</Label>
          {newItem.categoryId && categoryPriceList.length > 0 ? (
            <Select
              value={newItem.priceListItemId ?? ""}
              onChange={(e) => {
                const p = categoryPriceList.find((x) => x.id === e.target.value);
                if (!p) {
                  setNewItem({ ...newItem, priceListItemId: null, description: "", taxableAmount: "0", clientPrice: "" });
                  return;
                }
                const qty = Number(newItem.quantity) || 1;
                const taxableAmount = qty * p.unitPrice;
                setNewItem({
                  ...newItem,
                  priceListItemId: p.id,
                  quantity: newItem.quantity || "1",
                  description: p.specification ? `${p.name} — ${p.specification}` : p.name,
                  taxableAmount: taxableAmount.toFixed(2),
                });
              }}
            >
              <option value="">Voce libera — scrivi a mano</option>
              {categoryPriceList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatCurrency(p.unitPrice, true)}
                  {p.unit ? ` / ${p.unit}` : ""}
                  {p.vendor ? ` · ${p.vendor.name}` : ""}
                </option>
              ))}
            </Select>
          ) : (
            <p className="py-2 text-xs text-slate-400">
              {newItem.categoryId ? "Nessuna voce in libreria per questa categoria." : "Seleziona prima una categoria."}
            </p>
          )}
        </div>
        <div>
          <Label>{selectedPriceListItem ? `Quantità (${selectedPriceListItem.unit || "unità"})` : "Quantità"}</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            disabled={!selectedPriceListItem}
            value={newItem.quantity}
            onChange={(e) => {
              const qty = e.target.value;
              const taxableAmount = selectedPriceListItem ? Number(qty || 0) * selectedPriceListItem.unitPrice : Number(newItem.taxableAmount);
              setNewItem({
                ...newItem,
                quantity: qty,
                taxableAmount: selectedPriceListItem ? taxableAmount.toFixed(2) : newItem.taxableAmount,
              });
            }}
          />
          {selectedPriceListItem?.referenceQuantity && (
            <p className="mt-1 text-xs text-slate-400">{selectedPriceListItem.referenceQuantity}</p>
          )}
        </div>
        <div>
          <Label>Fornitore (opzionale)</Label>
          <Select value={newItem.vendorId ?? ""} onChange={(e) => setNewItem({ ...newItem, vendorId: e.target.value || null })}>
            <option value="">Nessuno</option>
            {(vendors ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <Label>Descrizione</Label>
          <Input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />
        </div>
        <div>
          <Label>Imponibile (€)</Label>
          <Input
            type="number"
            value={newItem.taxableAmount}
            onChange={(e) => setNewItem({ ...newItem, taxableAmount: e.target.value })}
          />
          {selectedPriceListItem && (
            <p className="mt-1 text-xs text-slate-400">Precompilato da quantità × prezzo di listino, modificabile.</p>
          )}
        </div>
        <div>
          <Label>IVA (%)</Label>
          <Input type="number" value={newItem.vatRatePct} onChange={(e) => setNewItem({ ...newItem, vatRatePct: e.target.value })} />
        </div>
        {isClientJob && (
          <div>
            <Label>Prezzo cliente (€)</Label>
            <Input
              type="number"
              placeholder={computeGroupClientPrice(group, Number(newItem.taxableAmount) || 0, deal).toFixed(2)}
              value={newItem.clientPrice}
              onChange={(e) => setNewItem({ ...newItem, clientPrice: e.target.value })}
            />
            <p className="mt-1 text-xs text-slate-400">
              Calcolato in automatico da imponibile + ricarico (Materiali/Lavorazioni), sempre modificabile.
            </p>
          </div>
        )}
        <div>
          <Label>Importo non imponibile (€)</Label>
          <Input
            type="number"
            value={newItem.nonTaxableAmount}
            onChange={(e) => setNewItem({ ...newItem, nonTaxableAmount: e.target.value })}
          />
          <p className="mt-1 text-xs text-slate-400">Per costi pagati in parte con fattura/IVA e in parte senza (es. contanti).</p>
        </div>
        <label className="mt-6 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={newItem.isMemo} onChange={(e) => setNewItem({ ...newItem, isMemo: e.target.checked })} />
          Voce memo (esclusa dai totali)
        </label>
        <label className="mt-6 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={newItem.isUnbilled}
            onChange={(e) => setNewItem({ ...newItem, isUnbilled: e.target.checked })}
          />
          Contanti / non fatturata
        </label>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
          <Button
            variant="secondary"
            disabled={!newItem.categoryId || !newItem.description || createItem.isPending || updateItem.isPending}
            onClick={() => {
              const data = {
                categoryId: newItem.categoryId,
                description: newItem.description,
                taxableAmount: Number(newItem.taxableAmount),
                vatRatePct: Number(newItem.vatRatePct),
                nonTaxableAmount: Number(newItem.nonTaxableAmount),
                clientPrice: newItem.clientPrice === "" ? null : Number(newItem.clientPrice),
                isMemo: newItem.isMemo,
                isUnbilled: newItem.isUnbilled,
                priceListItemId: newItem.priceListItemId || undefined,
                vendorId: newItem.vendorId,
              };
              if (editingItem) {
                updateItem.mutate({ id: editingItem.id, ...data }, { onSuccess: cancelEdit });
              } else {
                createItem.mutate({ dealId, ...data });
              }
            }}
          >
            {editingItem ? "Salva modifiche" : "Aggiungi voce"}
          </Button>
          {editingItem && (
            <button type="button" className="text-sm text-slate-500 hover:underline" onClick={cancelEdit}>
              Annulla modifica
            </button>
          )}
        </div>
      </div>
    </details>
  );
}
