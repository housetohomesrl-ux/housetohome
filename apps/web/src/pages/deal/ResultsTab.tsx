import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { trpc } from "../../lib/trpc";
import { formatCurrency, formatPercent } from "../../lib/format";
import type { DealDetail } from "../../lib/types";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Field";

const SCENARIO_LABEL: Record<string, string> = { PRUDENTE: "Prudente", REALISTICO: "Realistico", OTTIMISTICO: "Ottimistico" };
const SEVERITY_TONE: Record<string, "neutral" | "warning" | "danger"> = { INFO: "neutral", AVVISO: "warning", CRITICO: "danger" };

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

export default function ResultsTab({ deal }: { deal: DealDetail }) {
  const [scenario, setScenario] = useState<"PRUDENTE" | "REALISTICO" | "OTTIMISTICO">("REALISTICO");
  const results = trpc.results.forDeal.useQuery({ dealId: deal.id, scenario });
  const allScenarios = trpc.results.allScenarios.useQuery({ dealId: deal.id });
  const sensitivity = trpc.results.sensitivity.useQuery({ dealId: deal.id, scenario });
  const matrix = trpc.results.sensitivityMatrix.useQuery({ dealId: deal.id, scenario });

  const utils = trpc.useUtils();
  const [noteText, setNoteText] = useState("");
  const [noteSeverity, setNoteSeverity] = useState<"INFO" | "AVVISO" | "CRITICO">("AVVISO");
  const createNote = trpc.note.create.useMutation({
    onSuccess: () => {
      utils.deal.get.invalidate({ id: deal.id });
      setNoteText("");
    },
  });
  const resolveNote = trpc.note.resolve.useMutation({ onSuccess: () => utils.deal.get.invalidate({ id: deal.id }) });

  if (!results.data?.result) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-slate-500">
            Dati incompleti per calcolare i risultati: completa acquisizione, fiscalità, detenzione e almeno lo
            scenario di vendita selezionato.
          </p>
        </CardBody>
      </Card>
    );
  }

  const r = results.data.result;
  const costBreakdown = [
    { name: "Acquisizione", value: r.totals.totalAcquisitionCost },
    { name: "Ristrutturazione", value: r.totals.totalRenovationCost },
    { name: "Enti esterni", value: r.totals.totalEntiEsterniCost },
    { name: "Altro", value: r.totals.totalAltroCost },
    { name: "Detenzione", value: r.holding.total },
  ];

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500">Scenario:</span>
        <Select className="max-w-xs" value={scenario} onChange={(e) => setScenario(e.target.value as typeof scenario)}>
          {Object.entries(SCENARIO_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Costo totale progetto" value={formatCurrency(r.totals.totalProjectCost)} />
        <KpiCard label="Utile netto" value={formatCurrency(r.sale.netProfit)} tone={r.sale.netProfit >= 0 ? "success" : "danger"} />
        <KpiCard label="ROI" value={formatPercent(r.kpis.roi)} tone={r.kpis.roi >= 0 ? "success" : "danger"} />
        <KpiCard label="Cash-on-cash" value={formatPercent(r.kpis.cashOnCash)} />
        <KpiCard label="Prezzo di pareggio" value={formatCurrency(r.kpis.breakevenSalePrice)} />
        <KpiCard
          label="Cassa netta finale (equity)"
          value={formatCurrency(r.sourcesAndUses.finalNetCashToEquity)}
          tone={r.sourcesAndUses.finalNetCashToEquity >= 0 ? "success" : "danger"}
        />
      </div>

      <Card>
        <CardHeader title="Ripartizione costi" />
        <CardBody>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={costBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} width={90} />
              <Tooltip formatter={(v: number) => formatCurrency(v, true)} />
              <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Fonti e impieghi" subtitle="Verifica che il capitale disponibile copra il costo totale prima della vendita." />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <div className="text-sm">
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-500">Impieghi (costo totale)</span>
              <span className="font-medium">{formatCurrency(r.sourcesAndUses.usesTotal)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-500">Fonti: capitale proprio</span>
              <span className="font-medium">{formatCurrency(r.sourcesAndUses.equitySources)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-500">Fonti: finanziamenti</span>
              <span className="font-medium">{formatCurrency(r.sourcesAndUses.loanSources)}</span>
            </div>
            <div className="flex justify-between py-1.5 font-semibold">
              <span>Copertura</span>
              <span className={r.sourcesAndUses.isUndercovered ? "text-red-600" : "text-emerald-600"}>
                {formatCurrency(r.sourcesAndUses.coverage)}
              </span>
            </div>
            {r.sourcesAndUses.isUndercovered && (
              <Badge tone="danger">⚠ Scoperto da coprire: {formatCurrency(Math.abs(r.sourcesAndUses.coverage))}</Badge>
            )}
          </div>
          <div className="text-sm">
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-500">Incasso vendita</span>
              <span className="font-medium">{formatCurrency(r.sourcesAndUses.saleProceeds)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-500">− Capitale mutuo residuo</span>
              <span className="font-medium">{formatCurrency(r.sourcesAndUses.loanPrincipalRepaidAtSale)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-500">− Imposte</span>
              <span className="font-medium">{formatCurrency(r.taxes.totalTax)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-500">− Costi ancora da pagare</span>
              <span className="font-medium">{formatCurrency(r.sourcesAndUses.remainingUnpaidCosts)}</span>
            </div>
            <div className="flex justify-between py-1.5 font-semibold">
              <span>Cassa netta finale</span>
              <span>{formatCurrency(r.sourcesAndUses.finalNetCashToEquity)}</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {allScenarios.data && (
        <Card>
          <CardHeader title="Confronto scenari" />
          <CardBody className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                  <th className="py-2 pr-4"> </th>
                  {allScenarios.data.map((s) => (
                    <th key={s.scenario} className="py-2 pr-4">
                      {SCENARIO_LABEL[s.scenario]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-slate-500">Utile netto</td>
                  {allScenarios.data.map((s) => (
                    <td key={s.scenario} className="py-2 pr-4 font-medium">
                      {s.result ? formatCurrency(s.result.sale.netProfit) : "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-slate-500">ROI</td>
                  {allScenarios.data.map((s) => (
                    <td key={s.scenario} className="py-2 pr-4 font-medium">
                      {s.result ? formatPercent(s.result.kpis.roi) : "—"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {sensitivity.data?.result && (
        <Card>
          <CardHeader title="Analisi di sensitività" subtitle="Impatto sull'utile netto al variare di una singola variabile." />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-400">Prezzo di vendita</p>
              {sensitivity.data.result.salePriceScenarios.map((s) => (
                <div key={s.label} className="flex justify-between border-b border-slate-100 py-1 text-sm">
                  <span>{s.label}</span>
                  <span className={s.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}>{formatCurrency(s.netProfit)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-400">Sforamento lavorazioni</p>
              {sensitivity.data.result.lavorazioniOverrunScenarios.map((s) => (
                <div key={s.label} className="flex justify-between border-b border-slate-100 py-1 text-sm">
                  <span>{s.label}</span>
                  <span className={s.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}>{formatCurrency(s.netProfit)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-400">Ritardo tempistiche</p>
              {sensitivity.data.result.durationDelayScenarios.map((s) => (
                <div key={s.label} className="flex justify-between border-b border-slate-100 py-1 text-sm">
                  <span>{s.label}</span>
                  <span className={s.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}>{formatCurrency(s.netProfit)}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {matrix.data?.result && (
        <Card>
          <CardHeader title="Sensitività a doppia entrata" subtitle="Righe: prezzo di vendita · Colonne: sforamento sulle lavorazioni. Celle: utile netto." />
          <CardBody className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                  <th className="py-2 pr-4 text-left">Prezzo \ Sforamento</th>
                  {matrix.data.result.lavorazioniOverrunPct.map((o) => (
                    <th key={o} className="py-2 pr-4 text-right">
                      +{(o * 100).toFixed(0)}%
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.data.result.salePriceDeltasPct.map((priceDelta, i) => (
                  <tr key={priceDelta} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium">
                      {priceDelta === 0 ? "Base" : `${priceDelta > 0 ? "+" : ""}${(priceDelta * 100).toFixed(0)}%`}
                    </td>
                    {matrix.data!.result!.netProfitMatrix[i]!.map((value, j) => (
                      <td key={j} className={`py-2 pr-4 text-right ${value >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {formatCurrency(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Note e avvertenze" subtitle="Osservazioni legate a voci specifiche del deal, da tenere sott'occhio prima di decidere." />
        <CardBody>
          <div className="mb-4 flex gap-2">
            <Input placeholder="Es. Imposta di registro da confermare col notaio..." value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            <Select className="max-w-[140px]" value={noteSeverity} onChange={(e) => setNoteSeverity(e.target.value as typeof noteSeverity)}>
              <option value="INFO">Info</option>
              <option value="AVVISO">Avviso</option>
              <option value="CRITICO">Critico</option>
            </Select>
            <Button
              variant="secondary"
              disabled={!noteText || createNote.isPending}
              onClick={() => createNote.mutate({ dealId: deal.id, text: noteText, severity: noteSeverity })}
            >
              Aggiungi
            </Button>
          </div>
          <div className="grid gap-2">
            {deal.notes.map((note) => (
              <div key={note.id} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge tone={SEVERITY_TONE[note.severity]}>{note.severity}</Badge>
                  <span className={note.isResolved ? "text-sm text-slate-400 line-through" : "text-sm text-slate-700"}>{note.text}</span>
                </div>
                <button
                  className="text-xs text-brand-600 hover:underline"
                  onClick={() => resolveNote.mutate({ id: note.id, isResolved: !note.isResolved })}
                >
                  {note.isResolved ? "Riapri" : "Risolvi"}
                </button>
              </div>
            ))}
            {deal.notes.length === 0 && <p className="text-sm text-slate-400">Nessuna nota.</p>}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
