import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatCurrency } from "../../lib/format";
import type { DealDetail, CostLineItemDetail } from "../../lib/types";
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
  const total = taxable + vat;
  const due = total - item.paidAmount;
  return { vat, total, due };
}

const EMPTY_NEW_ITEM = {
  categoryId: "",
  description: "",
  quantity: "1",
  taxableAmount: "0",
  vatRatePct: "22",
  isMemo: false,
  isUnbilled: false,
  priceListItemId: "" as string | null,
};

export default function RenovationTab({ deal }: { deal: DealDetail }) {
  const utils = trpc.useUtils();
  const categories = trpc.costCategory.list.useQuery();
  const priceList = trpc.priceListItem.list.useQuery();
  const [contingencyPct, setContingencyPct] = useState(deal.renovationSettings?.contingencyPct.toString() ?? "12");
  const [newItem, setNewItem] = useState(EMPTY_NEW_ITEM);
  const selectedPriceListItem = priceList.data?.find((p) => p.id === newItem.priceListItemId) ?? null;
  const categoryPriceList = newItem.categoryId
    ? (priceList.data ?? []).filter((p) => p.categoryId === newItem.categoryId)
    : [];

  const saveContingency = trpc.dealSettings.updateRenovationSettings.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });
  const createItem = trpc.costLineItem.create.useMutation({
    onSuccess: () => {
      utils.deal.get.invalidate({ id: deal.id });
      setNewItem(EMPTY_NEW_ITEM);
    },
  });
  const updateItem = trpc.costLineItem.update.useMutation({ onSuccess: () => utils.deal.get.invalidate({ id: deal.id }) });
  const deleteItem = trpc.costLineItem.delete.useMutation({ onSuccess: () => utils.deal.get.invalidate({ id: deal.id }) });

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

      {Object.entries(GROUP_LABEL).map(([group, label]) => {
        const items = byGroup[group] ?? [];
        const groupCategories = categories.data?.filter((c) => c.group === group) ?? [];
        return (
          <Card key={group}>
            <CardHeader title={label} />
            <CardBody>
              {items.length > 0 && (
                <div className="mb-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                        <th className="py-2 pr-2">Descrizione</th>
                        <th className="py-2 pr-2">Categoria</th>
                        <th className="py-2 pr-2 text-right">Imponibile</th>
                        <th className="py-2 pr-2 text-right">IVA%</th>
                        <th className="py-2 pr-2 text-right">Totale</th>
                        <th className="py-2 pr-2 text-right">Pagato</th>
                        <th className="py-2 pr-2 text-right">Residuo</th>
                        <th className="py-2 pr-2">Stato</th>
                        <th className="py-2 pr-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const totals = rowTotals(item);
                        return (
                          <tr key={item.id} className="border-b border-slate-100">
                            <td className="py-2 pr-2">
                              {item.description}
                              {item.isMemo && <Badge tone="neutral">memo</Badge>}
                              {item.isUnbilled && (
                                <span className="ml-1">
                                  <Badge tone="warning">contanti/non fatt.</Badge>
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-2 text-slate-500">{item.category.name}</td>
                            <td className="py-2 pr-2 text-right">{formatCurrency(item.taxableAmount, true)}</td>
                            <td className="py-2 pr-2 text-right">{item.vatRatePct}%</td>
                            <td className="py-2 pr-2 text-right font-medium">{formatCurrency(totals.total, true)}</td>
                            <td className="py-2 pr-2 text-right">{formatCurrency(item.paidAmount, true)}</td>
                            <td className="py-2 pr-2 text-right">{formatCurrency(totals.due, true)}</td>
                            <td className="py-2 pr-2">
                              <Select
                                className="py-1 text-xs"
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
                            <td className="py-2 pr-2 text-right">
                              <button
                                className="text-xs text-red-500 hover:underline"
                                onClick={() => deleteItem.mutate({ id: item.id })}
                              >
                                Elimina
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <details className="rounded-md border border-dashed border-slate-300 p-3">
                <summary className="cursor-pointer text-sm font-medium text-brand-700">+ Aggiungi voce a "{label}"</summary>
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
                            setNewItem({ ...newItem, priceListItemId: null, description: "", taxableAmount: "0" });
                            return;
                          }
                          const qty = Number(newItem.quantity) || 1;
                          setNewItem({
                            ...newItem,
                            priceListItemId: p.id,
                            quantity: newItem.quantity || "1",
                            description: p.specification ? `${p.name} — ${p.specification}` : p.name,
                            taxableAmount: (qty * p.unitPrice).toFixed(2),
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
                        setNewItem({
                          ...newItem,
                          quantity: qty,
                          taxableAmount: selectedPriceListItem ? (Number(qty || 0) * selectedPriceListItem.unitPrice).toFixed(2) : newItem.taxableAmount,
                        });
                      }}
                    />
                    {selectedPriceListItem?.referenceQuantity && (
                      <p className="mt-1 text-xs text-slate-400">{selectedPriceListItem.referenceQuantity}</p>
                    )}
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label>Descrizione</Label>
                    <Input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />
                  </div>
                  <div>
                    <Label>Imponibile (€)</Label>
                    <Input
                      type="number"
                      variant={selectedPriceListItem ? "calculated" : "input"}
                      value={newItem.taxableAmount}
                      onChange={(e) => setNewItem({ ...newItem, taxableAmount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>IVA (%)</Label>
                    <Input type="number" value={newItem.vatRatePct} onChange={(e) => setNewItem({ ...newItem, vatRatePct: e.target.value })} />
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
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Button
                      variant="secondary"
                      disabled={!newItem.categoryId || !newItem.description || createItem.isPending}
                      onClick={() =>
                        createItem.mutate({
                          dealId: deal.id,
                          categoryId: newItem.categoryId,
                          description: newItem.description,
                          taxableAmount: Number(newItem.taxableAmount),
                          vatRatePct: Number(newItem.vatRatePct),
                          isMemo: newItem.isMemo,
                          isUnbilled: newItem.isUnbilled,
                          priceListItemId: newItem.priceListItemId || undefined,
                        })
                      }
                    >
                      Aggiungi voce
                    </Button>
                  </div>
                </div>
              </details>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
