import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatCurrency } from "../../lib/format";
import type { DealDetail } from "../../lib/types";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Input, Label } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { clientBasePrice, quoteVatRatePct } from "./RenovationTab";
import { formatDateIt } from "./PreventivoTab";

function toDateInputValue(d: string | Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

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

/** Un riquadro "Acconto N": % (facoltativa, ricalcola l'importo sulla base passata) + importo, sempre modificabile. */
function InstallmentBox({
  title,
  base,
  pct,
  amount,
  dueDate,
  onCommit,
  onDueDateChange,
}: {
  title: string;
  base: number;
  pct: number | null;
  amount: number;
  dueDate?: string | Date | null;
  onCommit: (data: { pct: number | null; amount: number }) => void;
  onDueDateChange?: (date: string | null) => void;
}) {
  const [pctValue, setPctValue] = useState(pct?.toString() ?? "");
  const [amountValue, setAmountValue] = useState(amount.toString());
  const [dueDateValue, setDueDateValue] = useState(toDateInputValue(dueDate));

  function commitPct() {
    const pctNum = pctValue === "" ? null : Number(pctValue);
    if (pctNum === null) {
      onCommit({ pct: null, amount: Number(amountValue || 0) });
      return;
    }
    const amountNum = Math.round(base * (pctNum / 100) * 100) / 100;
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
      {onDueDateChange && (
        <input
          type="date"
          className="mt-1 w-full rounded-md border border-slate-200 px-1 py-0.5 text-xs text-slate-500"
          value={dueDateValue}
          onChange={(e) => setDueDateValue(e.target.value)}
          onBlur={() => onDueDateChange(dueDateValue || null)}
          title="Scadenza prevista (opzionale): se passa e l'importo è ancora 0, compare un avviso nel Portafoglio"
        />
      )}
    </div>
  );
}

/**
 * Il riquadro "Saldo": solo importo, nessuna percentuale. Si aggiorna da
 * solo — finché non lo confermi a mano, mostra come suggerimento (placeholder)
 * quanto resta dopo i 3 acconti, e si ricalcola ogni volta che li modifichi.
 * Una volta inserito un importo esplicito, quello conta come saldo pagato/
 * incassato; resta comunque sempre modificabile.
 */
function SaldoBox({
  remaining,
  amount,
  onCommit,
  dueDate,
  onDueDateChange,
}: {
  remaining: number;
  amount: number;
  onCommit: (amount: number) => void;
  dueDate?: string | Date | null;
  onDueDateChange?: (date: string | null) => void;
}) {
  const [value, setValue] = useState(amount > 0 ? amount.toString() : "");
  const [dueDateValue, setDueDateValue] = useState(toDateInputValue(dueDate));
  return (
    <div className="rounded-md border border-slate-200 p-2">
      <div className="text-xs font-medium text-slate-500">Saldo</div>
      <div className="mt-1 flex items-center gap-1">
        <Input
          type="number"
          className="w-full py-1 text-right text-xs"
          placeholder={remaining.toFixed(2)}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => onCommit(value === "" ? 0 : Number(value))}
        />
        <span className="text-xs text-slate-400">€</span>
      </div>
      {onDueDateChange && (
        <input
          type="date"
          className="mt-1 w-full rounded-md border border-slate-200 px-1 py-0.5 text-xs text-slate-500"
          value={dueDateValue}
          onChange={(e) => setDueDateValue(e.target.value)}
          onBlur={() => onDueDateChange(dueDateValue || null)}
          title="Scadenza prevista (opzionale): se passa e l'importo è ancora 0, compare un avviso nel Portafoglio"
        />
      )}
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
  const acconto1Amount = payment?.acconto1Amount ?? 0;
  const acconto2Amount = payment?.acconto2Amount ?? 0;
  const acconto3Amount = payment?.acconto3Amount ?? 0;
  const saldoRemaining = cost - acconto1Amount - acconto2Amount - acconto3Amount;

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
          base={cost}
          pct={payment?.acconto1Pct ?? null}
          amount={acconto1Amount}
          onCommit={(d) => save.mutate({ dealId, vendorId, acconto1Pct: d.pct, acconto1Amount: d.amount })}
        />
        <InstallmentBox
          title="Acconto 2"
          base={cost}
          pct={payment?.acconto2Pct ?? null}
          amount={acconto2Amount}
          onCommit={(d) => save.mutate({ dealId, vendorId, acconto2Pct: d.pct, acconto2Amount: d.amount })}
        />
        <InstallmentBox
          title="Acconto 3"
          base={cost}
          pct={payment?.acconto3Pct ?? null}
          amount={acconto3Amount}
          onCommit={(d) => save.mutate({ dealId, vendorId, acconto3Pct: d.pct, acconto3Amount: d.amount })}
        />
        <SaldoBox
          remaining={saldoRemaining}
          amount={payment?.saldoAmount ?? 0}
          onCommit={(amount) => save.mutate({ dealId, vendorId, saldoAmount: amount })}
        />
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
  const [iresRatePct, setIresRatePct] = useState(deal.fiscalSettings?.iresRatePct.toString() ?? "24");
  const [irapRatePct, setIrapRatePct] = useState(deal.fiscalSettings?.irapRatePct.toString() ?? "3.9");

  const saveClientInstallment = trpc.deal.update.useMutation({
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
  // reali (quanto esce verso i fornitori, quanto entra dal cliente). L'IVA
  // del preventivo è una sola, sul totale (vedi tab Preventivo cliente).
  let totalCost = 0;
  let clientSubtotal = 0;
  let marginCost = 0;
  for (const item of items) {
    const costTotal = item.taxableAmount + (item.taxableAmount * item.vatRatePct) / 100 + item.nonTaxableAmount;
    totalCost += costTotal;
    clientSubtotal += clientBasePrice(item, deal);
    marginCost += item.taxableAmount + item.nonTaxableAmount;
  }
  const totalClientPrice = clientSubtotal * (1 + quoteVatRatePct(deal) / 100);

  // Saldo IVA (liquidazione): l'IVA incassata dal cliente sul preventivo è
  // IVA a debito verso l'Erario, l'IVA pagata ai fornitori (es. Cambielli al
  // 22%, i fornitori in regime forfettario/reverse charge non la addebitano)
  // è IVA a credito che si scala da quella a debito. Tenuta separata dai
  // totali sopra, che restano IVA inclusa perché sono i flussi di cassa reali.
  const outputVat = totalClientPrice - clientSubtotal;
  const inputVat = items.reduce((sum, item) => sum + (item.taxableAmount * item.vatRatePct) / 100, 0);
  const netVatDue = outputVat - inputVat;

  // Costi di detenzione: per una ristrutturazione cliente non è il costo di
  // possesso dell'immobile (non è nostro), ma i costi ricorrenti
  // dell'azienda legati alla durata del cantiere (assicurazione di
  // cantiere, altri costi fissi) — vanno comunque tolti dal margine.
  const holdingCosts = deal.holdingCosts;
  const holdingCostsTotal = holdingCosts
    ? holdingCosts.durationMonths * (holdingCosts.monthlyInsurance + holdingCosts.otherMonthlyCosts)
    : 0;
  const margin = clientSubtotal - marginCost - holdingCostsTotal;

  // Stima: IRES + IRAP sul margine (se positivo), con le aliquote della SRL
  // impostate qui sotto. Come per il flip, è una stima — la base imponibile
  // fiscale reale può differire e va sempre verificata con il commercialista.
  const companyTaxRatePct = (deal.fiscalSettings?.iresRatePct ?? 24) + (deal.fiscalSettings?.irapRatePct ?? 3.9);
  const companyTax = margin > 0 ? (margin * companyTaxRatePct) / 100 : 0;
  const netMarginAfterTax = margin - companyTax;

  // Preventivo iniziale vs consuntivo: confronta il margine stimato nella
  // versione PIÙ VECCHIA del preventivo salvata (vedi tab Preventivo
  // cliente, storico versioni) con il margine reale di oggi, per capire se
  // si sfora sistematicamente il preventivo iniziale.
  const snapshots = trpc.quoteSnapshot.list.useQuery({ dealId: deal.id });
  const earliestSnapshot =
    snapshots.data && snapshots.data.length > 0 ? snapshots.data[snapshots.data.length - 1] : null;
  const hasHistoricalCostData = earliestSnapshot ? earliestSnapshot.items.every((i) => i.cost !== undefined) : false;
  const estimatedPrice = earliestSnapshot ? earliestSnapshot.items.reduce((s, i) => s + i.price, 0) : 0;
  const estimatedCost = earliestSnapshot ? earliestSnapshot.items.reduce((s, i) => s + (i.cost ?? 0), 0) : 0;
  const estimatedMargin = estimatedPrice - estimatedCost;
  const marginDelta = margin - estimatedMargin;

  const clientAcconto1Amount = deal.clientAcconto1Amount ?? 0;
  const clientAcconto2Amount = deal.clientAcconto2Amount ?? 0;
  const clientAcconto3Amount = deal.clientAcconto3Amount ?? 0;
  const clientSaldoAmount = deal.clientSaldoAmount ?? 0;
  const receivedFromClient = clientAcconto1Amount + clientAcconto2Amount + clientAcconto3Amount + clientSaldoAmount;
  const dueFromClient = totalClientPrice - receivedFromClient;
  const clientSaldoRemaining = totalClientPrice - clientAcconto1Amount - clientAcconto2Amount - clientAcconto3Amount;

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
        <KpiCard label="Totale preventivo cliente (senza IVA)" value={formatCurrency(clientSubtotal)} />
        <KpiCard label={`Totale con IVA (${quoteVatRatePct(deal)}%)`} value={formatCurrency(totalClientPrice)} />
        <KpiCard
          label={netVatDue >= 0 ? "IVA a debito (da versare)" : "IVA a credito"}
          value={formatCurrency(Math.abs(netVatDue))}
          tone={netVatDue >= 0 ? "danger" : "success"}
        />
        <KpiCard label="Totale costi" value={formatCurrency(totalCost)} />
        <KpiCard label="Margine sulla ristrutturazione (al netto di IVA)" value={formatCurrency(margin)} tone={margin >= 0 ? "success" : "danger"} />
        <KpiCard
          label={`Margine netto (dopo tasse SRL, ${companyTaxRatePct.toFixed(1)}%)`}
          value={formatCurrency(netMarginAfterTax)}
          tone={netMarginAfterTax >= 0 ? "success" : "danger"}
        />
      </div>
      {holdingCostsTotal > 0 && (
        <p className="-mt-3 text-xs text-slate-400">
          Il margine include {formatCurrency(holdingCostsTotal, true)} di costi di detenzione (
          {holdingCosts!.durationMonths} mesi × {formatCurrency(holdingCosts!.monthlyInsurance + holdingCosts!.otherMonthlyCosts, true)}
          /mese, scheda Detenzione).
        </p>
      )}

      <Card>
        <CardHeader
          title="Preventivo iniziale vs consuntivo"
          subtitle="Margine stimato nella versione più vecchia del preventivo salvata (tab Preventivo cliente → Storico versioni) contro il margine reale di oggi, al netto di IVA. Non include i costi di detenzione, non ancora tracciati nello storico."
        />
        <CardBody>
          {!earliestSnapshot && (
            <p className="text-sm text-slate-400">
              Nessuna versione del preventivo salvata ancora: stampa o scarica il preventivo (tab "Preventivo cliente") per iniziare a tracciare
              il confronto.
            </p>
          )}
          {earliestSnapshot && !hasHistoricalCostData && (
            <p className="text-sm text-slate-400">
              La versione più vecchia salvata ({formatDateIt(earliestSnapshot.createdAt)}) non ha dati di costo storici (salvata prima che
              questa funzione esistesse): stampa o scarica di nuovo il preventivo per iniziare a tracciare il confronto da adesso.
            </p>
          )}
          {earliestSnapshot && hasHistoricalCostData && (
            <div className="grid gap-3 sm:grid-cols-3">
              <KpiCard label={`Margine stimato (preventivo del ${formatDateIt(earliestSnapshot.createdAt)})`} value={formatCurrency(estimatedMargin)} />
              <KpiCard label="Margine attuale (consuntivo)" value={formatCurrency(margin)} tone={margin >= 0 ? "success" : "danger"} />
              <KpiCard
                label="Differenza"
                value={`${marginDelta >= 0 ? "+" : ""}${formatCurrency(marginDelta)}`}
                tone={marginDelta >= 0 ? "success" : "danger"}
              />
            </div>
          )}
        </CardBody>
      </Card>

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
        <CardHeader
          title="Incassi dal cliente"
          subtitle="Fino a 3 acconti (con % calcolata sul totale preventivo, sempre modificabile) + saldo."
        />
        <CardBody className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <KpiCard label="Totale da incassare (preventivo)" value={formatCurrency(totalClientPrice)} />
            <KpiCard label="Residuo da incassare" value={formatCurrency(dueFromClient)} tone={dueFromClient > 0 ? "danger" : "success"} />
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <InstallmentBox
              title="Acconto 1"
              base={totalClientPrice}
              pct={deal.clientAcconto1Pct ?? null}
              amount={clientAcconto1Amount}
              dueDate={deal.clientAcconto1DueDate}
              onCommit={(d) => saveClientInstallment.mutate({ id: deal.id, clientAcconto1Pct: d.pct, clientAcconto1Amount: d.amount })}
              onDueDateChange={(date) => saveClientInstallment.mutate({ id: deal.id, clientAcconto1DueDate: date ? new Date(date) : null })}
            />
            <InstallmentBox
              title="Acconto 2"
              base={totalClientPrice}
              pct={deal.clientAcconto2Pct ?? null}
              amount={clientAcconto2Amount}
              dueDate={deal.clientAcconto2DueDate}
              onCommit={(d) => saveClientInstallment.mutate({ id: deal.id, clientAcconto2Pct: d.pct, clientAcconto2Amount: d.amount })}
              onDueDateChange={(date) => saveClientInstallment.mutate({ id: deal.id, clientAcconto2DueDate: date ? new Date(date) : null })}
            />
            <InstallmentBox
              title="Acconto 3"
              base={totalClientPrice}
              pct={deal.clientAcconto3Pct ?? null}
              amount={clientAcconto3Amount}
              dueDate={deal.clientAcconto3DueDate}
              onCommit={(d) => saveClientInstallment.mutate({ id: deal.id, clientAcconto3Pct: d.pct, clientAcconto3Amount: d.amount })}
              onDueDateChange={(date) => saveClientInstallment.mutate({ id: deal.id, clientAcconto3DueDate: date ? new Date(date) : null })}
            />
            <SaldoBox
              remaining={clientSaldoRemaining}
              amount={clientSaldoAmount}
              dueDate={deal.clientSaldoDueDate}
              onCommit={(amount) => saveClientInstallment.mutate({ id: deal.id, clientSaldoAmount: amount })}
              onDueDateChange={(date) => saveClientInstallment.mutate({ id: deal.id, clientSaldoDueDate: date ? new Date(date) : null })}
            />
          </div>
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
