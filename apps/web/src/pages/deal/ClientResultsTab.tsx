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
        <CardHeader title="Pagamenti ai fornitori" subtitle="Quanto hai già pagato per i materiali/lavorazioni e quanto manca." />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          <KpiCard label="Totale costi" value={formatCurrency(totalCost)} />
          <KpiCard label="Pagato ai fornitori" value={formatCurrency(totalPaidToVendors)} />
          <KpiCard label="Residuo da pagare" value={formatCurrency(dueToVendors)} tone={dueToVendors > 0 ? "danger" : "success"} />
        </CardBody>
      </Card>
    </div>
  );
}
