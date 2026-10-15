import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatCurrency } from "../../lib/format";
import type { DealDetail } from "../../lib/types";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Input, Label } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { clientBasePrice, clientFinalPrice } from "./RenovationTab";

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

type VendorPayment = DealDetail["vendorPayments"][number];

/** Un riquadro "Acconto N": % (facoltativa, ricalcola l'importo sul totale costi del fornitore) + importo, sempre modificabile. */
function InstallmentBox({
  title,
  cost,
  pct,
  amount,
  onCommit,
}: {
  title: string;
  cost: number;
  pct: number | null;
  amount: number;
  onCommit: (data: { pct: number | null; amount: number }) => void;
}) {
  const [pctValue, setPctValue] = useState(pct?.toString() ?? "");
  const [amountValue, setAmountValue] = useState(amount.toString());

  function commitPct() {
    const pctNum = pctValue === "" ? null : Number(pctValue);
    if (pctNum === null) {
      onCommit({ pct: null, amount: Number(amountValue || 0) });
      return;
    }
    const amountNum = Math.round(cost * (pctNum / 100) * 100) / 100;
    setAmountValue(amountNum.toString());
    onCommit({ pct: pctNum, amount: amountNum });
  }

  function commitAmount() {
    onCommit({ pct: pctValue === "" ? null : Number(pctValue), amount: Number(amountValue || 0) });
  }

  return (
    <div className="rounded-md border border-slate-200 p-2">
      <div className="text-xs font-medium text-slate-500">{title}</div>
      <div className="mt-1 flex items-center gap-1">
        <Input
          type="number"
          className="w-14 py-1 text-right text-xs"
          placeholder="%"
          value={pctValue}
          onChange={(e) => setPctValue(e.target.value)}
          onBlur={commitPct}
        />
        <span className="text-xs text-slate-400">%</span>
        <Input
          type="number"
          className="w-full py-1 text-right text-xs"
          value={amountValue}
          onChange={(e) => setAmountValue(e.target.value)}
          onBlur={commitAmount}
        />
        <span className="text-xs text-slate-400">€</span>
      </div>
    </div>
  );
}

/** Il riquadro "Saldo": solo importo, nessuna percentuale. */
function SaldoBox({ amount, onCommit }: { amount: number; onCommit: (amount: number) => void }) {
  const [value, setValue] = useState(amount.toString());
  return (
    <div className="rounded-md border border-slate-200 p-2">
      <div className="text-xs font-medium text-slate-500">Saldo</div>
      <div className="mt-1 flex items-center gap-1">
        <Input
          type="number"
          className="w-full py-1 text-right text-xs"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => onCommit(Number(value || 0))}
        />
        <span className="text-xs text-slate-400">€</span>
      </div>
    </div>
  );
}

function VendorPaymentCard({
  dealId,
  vendorId,
  label,
  cost,
  paid,
  payment,
}: {
  dealId: string;
  vendorId: string | null;
  label: string;
  cost: number;
  paid: number;
  payment: VendorPayment | undefined;
}) {
  const utils = trpc.useUtils();
  const save = trpc.dealSettings.upsertVendorPayment.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: dealId }),
  });
  const due = cost - paid;

  if (!vendorId) {
    return (
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="flex items-center justify-between">
          <div className="font-medium text-slate-800">{label}</div>
          <div className="text-sm text-slate-500">Totale costi: {formatCurrency(cost, true)}</div>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-emerald-700">Pagato: {formatCurrency(paid, true)}</span>
          <span className={due > 0 ? "text-red-600" : "text-slate-500"}>Residuo da pagare: {formatCurrency(due, true)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-slate-800">{label}</div>
        <div className="text-sm text-slate-500">Totale costi: {formatCurrency(cost, true)}</div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <InstallmentBox
          title="Acconto 1"
          cost={cost}
          pct={payment?.acconto1Pct ?? null}
          amount={payment?.acconto1Amount ?? 0}
          onCommit={(d) => save.mutate({ dealId, vendorId, acconto1Pct: d.pct, acconto1Amount: d.amount })}
        />
        <InstallmentBox
          title="Acconto 2"
          cost={cost}
          pct={payment?.acconto2Pct ?? null}
          amount={payment?.acconto2Amount ?? 0}
          onCommit={(d) => save.mutate({ dealId, vendorId, acconto2Pct: d.pct, acconto2Amount: d.amount })}
        />
        <InstallmentBox
          title="Acconto 3"
          cost={cost}
          pct={payment?.acconto3Pct ?? null}
          amount={payment?.acconto3Amount ?? 0}
          onCommit={(d) => save.mutate({ dealId, vendorId, acconto3Pct: d.pct, acconto3Amount: d.amount })}
        />
        <SaldoBox amount={payment?.saldoAmount ?? 0} onCommit={(amount) => save.mutate({ dealId, vendorId, saldoAmount: amount })} />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-emerald-700">Pagato: {formatCurrency(paid, true)}</span>
        <span className={due > 0 ? "text-red-600" : "text-slate-500"}>Residuo da pagare: {formatCurrency(due, true)}</span>
      </div>
    </div>
  );
}

function vendorPaymentTotal(p: VendorPayment): number {
  return p.acconto1Amount + p.acconto2Amount + p.acconto3Amount + p.saldoAmount;
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
  const [iresRatePct, setIresRatePct] = useState(deal.fiscalSettings?.iresRatePct.toString() ?? "24");
  const [irapRatePct, setIrapRatePct] = useState(deal.fiscalSettings?.irapRatePct.toString() ?? "3.9");

  const saveReceived = trpc.deal.update.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });
  const saveFiscal = trpc.dealSettings.updateFiscalSettings.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });

  const items = deal.costLineItems.filter((i) => !i.isMemo);

  // Il margine si calcola al netto dell'IVA: quella che paghiamo sui
  // materiali e quella che giriamo al cliente sono un semplice passaggio
  // verso l'erario, non un guadagno. "Totale costi" e "Totale preventivo
  // cliente" restano invece con IVA inclusa, perché sono i flussi di cassa
  // reali (quanto esce verso i fornitori, quanto entra dal cliente).
  let totalCost = 0;
  let totalClientPrice = 0;
  let marginCost = 0;
  let marginRevenue = 0;
  for (const item of items) {
    const costTotal = item.taxableAmount + (item.taxableAmount * item.vatRatePct) / 100 + item.nonTaxableAmount;
    totalCost += costTotal;
    totalClientPrice += clientFinalPrice(item, deal);
    marginCost += item.taxableAmount + item.nonTaxableAmount;
    marginRevenue += clientBasePrice(item, deal);
  }
  const margin = marginRevenue - marginCost;

  // Stima: IRES + IRAP sul margine (se positivo), con le aliquote della SRL
  // impostate qui sotto. Come per il flip, è una stima — la base imponibile
  // fiscale reale può differire e va sempre verificata con il commercialista.
  const companyTaxRatePct = (deal.fiscalSettings?.iresRatePct ?? 24) + (deal.fiscalSettings?.irapRatePct ?? 3.9);
  const companyTax = margin > 0 ? (margin * companyTaxRatePct) / 100 : 0;
  const netMarginAfterTax = margin - companyTax;

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
  const paymentByVendorId = new Map(deal.vendorPayments.map((p) => [p.vendorId, p]));
  const vendorRows = [...vendorTotals.values()]
    .map((v) => {
      const payment = v.vendorId ? paymentByVendorId.get(v.vendorId) : undefined;
      const paid = v.vendorId ? (payment ? vendorPaymentTotal(payment) : 0) : noVendorPaid;
      return { ...v, payment, paid };
    })
    .sort((a, b) => b.cost - a.cost);
  const totalPaidToVendors = vendorRows.reduce((sum, v) => sum + v.paid, 0);
  const dueToVendors = totalCost - totalPaidToVendors;

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Totale preventivo cliente" value={formatCurrency(totalClientPrice)} />
        <KpiCard label="Totale costi" value={formatCurrency(totalCost)} />
        <KpiCard label="Margine sulla ristrutturazione" value={formatCurrency(margin)} tone={margin >= 0 ? "success" : "danger"} />
        <KpiCard
          label={`Margine netto (dopo tasse SRL, ${companyTaxRatePct.toFixed(1)}%)`}
          value={formatCurrency(netMarginAfterTax)}
          tone={netMarginAfterTax >= 0 ? "success" : "danger"}
        />
      </div>

      <Card>
        <CardHeader
          title="Aliquote tasse società"
          subtitle="IRES + IRAP applicate sul margine (se positivo), per calcolare il margine netto qui sopra. È una stima, da verificare col commercialista."
        />
        <CardBody className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="ires">IRES (%)</Label>
            <Input id="ires" type="number" className="w-28" value={iresRatePct} onChange={(e) => setIresRatePct(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="irap">IRAP (%)</Label>
            <Input id="irap" type="number" className="w-28" value={irapRatePct} onChange={(e) => setIrapRatePct(e.target.value)} />
          </div>
          <Button
            variant="secondary"
            disabled={saveFiscal.isPending}
            onClick={() =>
              saveFiscal.mutate({
                dealId: deal.id,
                regimeType: deal.fiscalSettings?.regimeType ?? "SOCIETA_CAPITALI",
                saleSubjectToVat: deal.fiscalSettings?.saleSubjectToVat ?? false,
                costsVatRecoverable: deal.fiscalSettings?.costsVatRecoverable ?? false,
                iresRatePct: Number(iresRatePct),
                irapRatePct: Number(irapRatePct),
                capitalGainsTaxRatePct: deal.fiscalSettings?.capitalGainsTaxRatePct ?? 26,
              })
            }
          >
            Salva
          </Button>
        </CardBody>
      </Card>

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
        <CardHeader
          title="Pagamenti ai fornitori"
          subtitle='Diviso per fornitore: fino a 3 acconti (con % calcolata sul totale costi, sempre modificabile) + saldo.'
        />
        <CardBody className="grid gap-3">
          {vendorRows.map((v) => (
            <VendorPaymentCard
              key={v.vendorId ?? "__none__"}
              dealId={deal.id}
              vendorId={v.vendorId}
              label={v.label}
              cost={v.cost}
              paid={v.paid}
              payment={v.payment}
            />
          ))}
          {vendorRows.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">Nessuna voce ancora inserita nella scheda Ristrutturazione.</p>
          )}
          {vendorRows.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm font-semibold">
              <span>Totale</span>
              <div className="flex gap-4">
                <span>Costi: {formatCurrency(totalCost, true)}</span>
                <span className="text-emerald-700">Pagato: {formatCurrency(totalPaidToVendors, true)}</span>
                <span className={dueToVendors > 0 ? "text-red-600" : "text-slate-500"}>
                  Residuo: {formatCurrency(dueToVendors, true)}
                </span>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
