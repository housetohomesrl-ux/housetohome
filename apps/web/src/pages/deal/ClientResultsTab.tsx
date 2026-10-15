import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatCurrency } from "../../lib/format";
import type { DealDetail } from "../../lib/types";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Input, Label } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { autoClientPrice } from "./RenovationTab";

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${tone === "success" ? "text-emerald-600" : tone === "danger" ? "text-red-600" : "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
}

/**
 * Risultati per un deal RISTRUTTURAZIONE_CLIENTE: niente ROI/plusvalenza
 * (non c'è acquisto né vendita dell'immobile). Mostra invece quanto si sta
 * guadagnando sulla ristrutturazione (prezzo cliente - costo) e il
 * dettaglio di cosa è stato incassato dal cliente / pagato ai fornitori e
 * cosa manca ancora, calcolati direttamente dalle voci di costo del
 * preventivo (non serve il motore di calcolo acquisto/vendita).
 */
export default function ClientResultsTab({ deal }: { deal: DealDetail }) {
  const utils = trpc.useUtils();
  const [received, setReceived] = useState(deal.clientAmountReceived?.toString() ?? "0");

  const saveReceived = trpc.deal.update.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });

  const items = deal.costLineItems.filter((i) => !i.isMemo);

  let totalCost = 0;
  let totalPaidToVendors = 0;
  let totalClientPrice = 0;
  for (const item of items) {
    const costTotal = item.taxableAmount + (item.taxableAmount * item.vatRatePct) / 100 + item.nonTaxableAmount;
    totalCost += costTotal;
    totalPaidToVendors += item.paidAmount;
    const clientBase = item.clientPrice ?? autoClientPrice(item, deal);
    totalClientPrice += clientBase + (clientBase * item.vatRatePct) / 100;
  }
  const dueToVendors = totalCost - totalPaidToVendors;
  const margin = totalClientPrice - totalCost;
  const receivedFromClient = deal.clientAmountReceived ?? 0;
  const dueFromClient = totalClientPrice - receivedFromClient;

  const vendorTotals = new Map<string, { label: string; cost: number; paid: number }>();
  for (const item of items) {
    const key = item.vendorId ?? "__none__";
    const label = item.vendor?.name ?? "Senza fornitore";
    const costTotal = item.taxableAmount + (item.taxableAmount * item.vatRatePct) / 100 + item.nonTaxableAmount;
    const g = vendorTotals.get(key) ?? { label, cost: 0, paid: 0 };
    g.cost += costTotal;
    g.paid += item.paidAmount;
    vendorTotals.set(key, g);
  }
  const vendorRows = [...vendorTotals.values()].sort((a, b) => b.cost - a.cost);

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Totale preventivo cliente" value={formatCurrency(totalClientPrice)} />
        <KpiCard label="Totale costi" value={formatCurrency(totalCost)} />
        <KpiCard label="Margine sulla ristrutturazione" value={formatCurrency(margin)} tone={margin >= 0 ? "success" : "danger"} />
      </div>

      <Card>
        <CardHeader title="Incassi dal cliente" subtitle="Quanto hai già incassato e quanto resta da farti pagare." />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="Totale da incassare (preventivo)" value={formatCurrency(totalClientPrice)} />
          <div>
            <Label htmlFor="received">Incassato (€)</Label>
            <Input id="received" type="number" value={received} onChange={(e) => setReceived(e.target.value)} />
            <Button
              variant="secondary"
              className="mt-2"
              onClick={() => saveReceived.mutate({ id: deal.id, clientAmountReceived: Number(received) })}
              disabled={saveReceived.isPending}
            >
              Salva
            </Button>
          </div>
          <KpiCard label="Residuo da incassare" value={formatCurrency(dueFromClient)} tone={dueFromClient > 0 ? "danger" : "success"} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Pagamenti ai fornitori" subtitle="Quanto hai già pagato e quanto manca, diviso per fornitore." />
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2 pr-4">Fornitore</th>
                <th className="py-2 pr-4 text-right">Totale costi</th>
                <th className="py-2 pr-4 text-right">Pagato</th>
                <th className="py-2 pr-4 text-right">Residuo da pagare</th>
              </tr>
            </thead>
            <tbody>
              {vendorRows.map((v) => {
                const due = v.cost - v.paid;
                return (
                  <tr key={v.label} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{v.label}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(v.cost, true)}</td>
                    <td className="py-2 pr-4 text-right text-emerald-700">{formatCurrency(v.paid, true)}</td>
                    <td className={`py-2 pr-4 text-right ${due > 0 ? "text-red-600" : "text-slate-500"}`}>
                      {formatCurrency(due, true)}
                    </td>
                  </tr>
                );
              })}
              {vendorRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-slate-400">
                    Nessuna voce ancora inserita nella scheda Ristrutturazione.
                  </td>
                </tr>
              )}
              {vendorRows.length > 0 && (
                <tr className="font-semibold">
                  <td className="py-2 pr-4">Totale</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(totalCost, true)}</td>
                  <td className="py-2 pr-4 text-right text-emerald-700">{formatCurrency(totalPaidToVendors, true)}</td>
                  <td className={`py-2 pr-4 text-right ${dueToVendors > 0 ? "text-red-600" : "text-slate-500"}`}>
                    {formatCurrency(dueToVendors, true)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
