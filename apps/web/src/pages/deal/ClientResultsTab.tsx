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

function VendorPaymentRow({
  dealId,
  vendorId,
  label,
  cost,
  paid,
}: {
  dealId: string;
  vendorId: string | null;
  label: string;
  cost: number;
  paid: number;
}) {
  const utils = trpc.useUtils();
  const [value, setValue] = useState(paid.toString());
  const savePayment = trpc.dealSettings.upsertVendorPayment.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: dealId }),
  });
  const due = cost - paid;

  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pr-4">{label}</td>
      <td className="py-2 pr-4 text-right">{formatCurrency(cost, true)}</td>
      <td className="py-2 pr-4 text-right">
        {vendorId ? (
          <div className="flex items-center justify-end gap-2">
            <Input
              type="number"
              className="w-28 text-right"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => {
                if (Number(value) !== paid) savePayment.mutate({ dealId, vendorId, amountPaid: Number(value || 0) });
              }}
            />
          </div>
        ) : (
          <span className="text-emerald-700">{formatCurrency(paid, true)}</span>
        )}
      </td>
      <td className={`py-2 pr-4 text-right ${due > 0 ? "text-red-600" : "text-slate-500"}`}>{formatCurrency(due, true)}</td>
    </tr>
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
  let totalClientPrice = 0;
  for (const item of items) {
    const costTotal = item.taxableAmount + (item.taxableAmount * item.vatRatePct) / 100 + item.nonTaxableAmount;
    totalCost += costTotal;
    const clientBase = item.clientPrice ?? autoClientPrice(item, deal);
    totalClientPrice += clientBase + (clientBase * item.vatRatePct) / 100;
  }
  const margin = totalClientPrice - totalCost;
  const receivedFromClient = deal.clientAmountReceived ?? 0;
  const dueFromClient = totalClientPrice - receivedFromClient;

  // Il "Pagato" per fornitore è inserito a mano (vedi VendorPaymentRow sotto),
  // non la somma dei paidAmount delle singole voci: in pratica i pagamenti
  // sono a rate (acconto + acconto + saldo) e non corrispondono 1:1 alle
  // voci di lavorazione. L'eccezione è il gruppo "Senza fornitore", dove non
  // c'è un fornitore a cui agganciare un pagamento: lì si somma paidAmount.
  const vendorTotals = new Map<string, { vendorId: string | null; label: string; cost: number }>();
  for (const item of items) {
    const key = item.vendorId ?? "__none__";
    const label = item.vendor?.name ?? "Senza fornitore";
    const costTotal = item.taxableAmount + (item.taxableAmount * item.vatRatePct) / 100 + item.nonTaxableAmount;
    const g = vendorTotals.get(key) ?? { vendorId: item.vendorId, label, cost: 0 };
    g.cost += costTotal;
    vendorTotals.set(key, g);
  }
  const noVendorPaid = items.filter((i) => !i.vendorId).reduce((sum, i) => sum + i.paidAmount, 0);
  const paymentByVendorId = new Map(deal.vendorPayments.map((p) => [p.vendorId, p.amountPaid]));
  const vendorRows = [...vendorTotals.values()]
    .map((v) => ({ ...v, paid: v.vendorId ? paymentByVendorId.get(v.vendorId) ?? 0 : noVendorPaid }))
    .sort((a, b) => b.cost - a.cost);
  const totalPaidToVendors = vendorRows.reduce((sum, v) => sum + v.paid, 0);
  const dueToVendors = totalCost - totalPaidToVendors;

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
              {vendorRows.map((v) => (
                <VendorPaymentRow key={v.vendorId ?? "__none__"} dealId={deal.id} vendorId={v.vendorId} label={v.label} cost={v.cost} paid={v.paid} />
              ))}
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
