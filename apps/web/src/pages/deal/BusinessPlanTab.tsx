import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { trpc } from "../../lib/trpc";
import { formatCurrency, formatPercent } from "../../lib/format";
import type { DealDetail } from "../../lib/types";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input, Label, Select } from "../../components/ui/Field";

// Business plan dell'operazione per investitori: stessi numeri della tab
// Risultati (motore di calcolo condiviso), impaginati secondo la struttura
// standard House to Home e stampabili in PDF dal browser.

const SCENARIO_LABEL: Record<string, string> = { PRUDENTE: "Prudente", REALISTICO: "Realistico", OTTIMISTICO: "Ottimistico" };
const GROUP_LABEL: Record<string, string> = {
  LAVORAZIONI: "Lavorazioni",
  MATERIALI: "Materiali",
  ENTI_ESTERNI: "Enti esterni",
  ALTRO: "Altro",
};
const LOAN_TYPE_LABEL: Record<string, string> = { MUTUO_PONTE: "Mutuo ponte", PRESTITO_SOCI: "Prestito soci", ALTRO: "Altro" };
const AMORTIZATION_LABEL: Record<string, string> = { INTEREST_ONLY: "solo interessi", FRENCH: "alla francese", MANUAL: "piano banca" };
const REGIME_LABEL: Record<string, string> = {
  SOCIETA_CAPITALI: "IRES + IRAP (società di capitali)",
  PERSONA_FISICA: "imposta sostitutiva sulla plusvalenza",
  ALTRO: "non calcolate",
};

const pct = (v: number | null) => (v === null ? "—" : formatPercent(v));

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between border-b border-slate-100 py-1.5 text-sm ${strong ? "font-semibold" : ""}`}>
      <span className={muted ? "text-slate-500" : strong ? "" : "text-slate-600"}>{label}</span>
      <span className={strong ? "" : "font-medium"}>{value}</span>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 break-inside-avoid">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

function Section({ n, title, subtitle, children }: { n: number; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="break-inside-avoid print:shadow-none">
      <CardHeader title={`${n}. ${title}`} subtitle={subtitle} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

export default function BusinessPlanTab({ deal }: { deal: DealDetail }) {
  const [scenario, setScenario] = useState<"PRUDENTE" | "REALISTICO" | "OTTIMISTICO">("REALISTICO");
  const [renovationMonths, setRenovationMonths] = useState("");
  const bp = trpc.businessPlan.forDeal.useQuery({
    dealId: deal.id,
    scenario,
    renovationMonths: Number(renovationMonths) > 0 ? Math.floor(Number(renovationMonths)) : undefined,
  });

  if (bp.isLoading) return <p className="text-sm text-slate-400">Calcolo del business plan...</p>;
  if (!bp.data) return <p className="text-sm text-red-600">Impossibile calcolare il business plan.</p>;

  const { plan, preventivo } = bp.data;
  if (!plan) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-slate-500">
            Dati incompleti: per il business plan servono acquisizione, fiscalità, detenzione e il prezzo di vendita dello
            scenario selezionato.
          </p>
        </CardBody>
      </Card>
    );
  }

  const { kpis, financials: f, cashFlow } = plan;
  const pessimistic = plan.scenarios.find((s) => s.key === "PESSIMISTICO");
  const capitalRequired = Math.max(cashFlow.peakFundingNeed, kpis.equityInvested);
  const loanTotal = bp.data.loans.reduce((acc, l) => acc + l.principalAmount, 0);

  const risks: Array<{ tone: "danger" | "warning" | "neutral"; text: string }> = [];
  if (preventivo.toQuoteLines.length > 0) {
    risks.push({
      tone: "warning",
      text: `${preventivo.toQuoteLines.length} voci del preventivo sono ancora DA QUOTARE: i costi lavori sono sottostimati finché non hanno un prezzo.`,
    });
  }
  if (cashFlow.equityHeadroom < 0) {
    risks.push({
      tone: "danger",
      text: `Il capitale proprio (${formatCurrency(kpis.equityInvested)}) non copre il fabbisogno massimo di cassa (${formatCurrency(cashFlow.peakFundingNeed)} al mese ${cashFlow.peakFundingMonth}): mancano ${formatCurrency(-cashFlow.equityHeadroom)}.`,
    });
  }
  if (pessimistic && pessimistic.kpis.netMargin < 0) {
    risks.push({ tone: "danger", text: `Nello scenario pessimistico l'operazione chiude in perdita (${formatCurrency(pessimistic.kpis.netMargin)}).` });
  }
  if (preventivo.unbilledTaxable > 0) {
    risks.push({ tone: "warning", text: `${formatCurrency(preventivo.unbilledTaxable)} di lavori risultano non fatturati: non documentabili verso terzi.` });
  }
  if (preventivo.lineCount > 0 && preventivo.priceListCoverage < 1) {
    risks.push({
      tone: "neutral",
      text: `Il ${formatPercent(1 - preventivo.priceListCoverage)} dell'imponibile lavori non proviene dalla Libreria prezzi (voci libere).`,
    });
  }
  if (f.taxes.isEstimate) {
    risks.push({ tone: "neutral", text: "Le imposte sono una stima: base imponibile e aliquote vanno confermate dal commercialista." });
  }
  for (const note of bp.data.openNotes) {
    risks.push({ tone: note.severity === "CRITICO" ? "danger" : "warning", text: note.text });
  }

  return (
    <div className="grid gap-5 print:gap-3">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <Label>Scenario di vendita base</Label>
          <Select className="w-44" value={scenario} onChange={(e) => setScenario(e.target.value as typeof scenario)}>
            {Object.entries(SCENARIO_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Mesi di cantiere</Label>
          <Input
            type="number"
            min="1"
            className="w-32"
            placeholder={String(cashFlow.renovationMonths)}
            value={renovationMonths}
            onChange={(e) => setRenovationMonths(e.target.value)}
          />
        </div>
        <Button variant="secondary" onClick={() => window.print()}>
          Stampa / salva PDF
        </Button>
        {bp.data.deal.isDemo && <Badge tone="neutral">Dati demo</Badge>}
      </div>

      <Section n={1} title="Sintesi dell'operazione">
        <p className="mb-4 text-sm text-slate-600">
          Acquisto, ristrutturazione e rivendita di {bp.data.deal.propertyType?.toLowerCase() || "immobile"}
          {bp.data.deal.address ? ` in ${bp.data.deal.address}` : ""}. Durata prevista {kpis.durationMonths} mesi, capitale
          richiesto {formatCurrency(capitalRequired)}, margine netto atteso {formatCurrency(kpis.netMargin)} (ROI{" "}
          {formatPercent(kpis.roi)}, {formatPercent(kpis.annualizedRoi)} annualizzato).
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Kpi label="Capitale richiesto" value={formatCurrency(capitalRequired)} hint="fabbisogno massimo di cassa" />
          <Kpi label="Prezzo di vendita" value={formatCurrency(kpis.salePrice)} hint={`scenario ${SCENARIO_LABEL[scenario]?.toLowerCase()}`} />
          <Kpi label="Costo totale operazione" value={formatCurrency(kpis.totalProjectCost)} />
          <Kpi label="Margine netto" value={formatCurrency(kpis.netMargin)} />
          <Kpi label="ROI" value={formatPercent(kpis.roi)} hint={`${formatPercent(kpis.annualizedRoi)} annualizzato`} />
          <Kpi label="ROE" value={pct(kpis.roe)} hint={kpis.annualizedRoe === null ? undefined : `${formatPercent(kpis.annualizedRoe)} annualizzato`} />
          <Kpi label="Durata" value={`${kpis.durationMonths} mesi`} />
          <Kpi label="Prezzo di pareggio" value={formatCurrency(f.kpis.breakevenSalePrice)} />
        </div>
      </Section>

      <Section n={2} title="Piano di acquisizione">
        <div className="max-w-xl">
          <Row label="Prezzo di acquisto" value={formatCurrency(bp.data.deal.purchasePrice, true)} />
          {bp.data.acquisitionLines.map((l) => (
            <Row
              key={l.id}
              label={`${l.description}${l.vatRatePct ? ` (IVA ${l.vatRatePct}%)` : ""}`}
              value={formatCurrency(l.taxableAmount * (bp.data!.deal.costsVatRecoverable ? 1 : 1 + l.vatRatePct / 100), true)}
              muted
            />
          ))}
          <Row label="Totale acquisizione" value={formatCurrency(f.totals.totalAcquisitionCost, true)} strong />
        </div>
      </Section>

      <Section
        n={3}
        title="Piano lavori"
        subtitle={`Dal preventivo del deal: ${preventivo.lineCount} voci, ${formatPercent(preventivo.priceListCoverage)} dell'imponibile dalla Libreria prezzi.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2 pr-2">Categoria</th>
                <th className="py-2 pr-2 text-right">Voci</th>
                <th className="py-2 pr-2 text-right">Imponibile</th>
                <th className="py-2 pr-2 text-right">IVA</th>
                <th className="py-2 pr-2 text-right">Totale</th>
              </tr>
            </thead>
            <tbody>
              {preventivo.categories.map((c) => (
                <tr key={`${c.group}-${c.categoryName}`} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2">
                    <span className="text-slate-400">{GROUP_LABEL[c.group]} · </span>
                    {c.categoryName}
                  </td>
                  <td className="py-1.5 pr-2 text-right">{c.lineCount}</td>
                  <td className="py-1.5 pr-2 text-right">{formatCurrency(c.taxable, true)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatCurrency(c.vat, true)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatCurrency(c.total, true)}</td>
                </tr>
              ))}
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-2">Imprevisti ({preventivo.contingencyPct}% su lavorazioni e materiali)</td>
                <td />
                <td className="py-1.5 pr-2 text-right">{formatCurrency(preventivo.contingencyAmount, true)}</td>
                <td />
                <td className="py-1.5 pr-2 text-right">{formatCurrency(preventivo.contingencyAmount, true)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="py-2 pr-2">Totale lavori</td>
                <td className="py-2 pr-2 text-right">{preventivo.lineCount}</td>
                <td className="py-2 pr-2 text-right">{formatCurrency(preventivo.taxable + preventivo.contingencyAmount, true)}</td>
                <td className="py-2 pr-2 text-right">{formatCurrency(preventivo.vat, true)}</td>
                <td className="py-2 pr-2 text-right">{formatCurrency(preventivo.total, true)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {preventivo.highlightedLines.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium uppercase text-slate-400">Voci principali</p>
            {preventivo.highlightedLines.map((l) => (
              <Row
                key={l.id}
                label={`${l.description}${l.vendorName ? ` · ${l.vendorName}` : ""}`}
                value={formatCurrency(l.total, true)}
                muted
              />
            ))}
          </div>
        )}

        {preventivo.toQuoteLines.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium uppercase text-amber-600">Da quotare</p>
            {preventivo.toQuoteLines.map((l) => (
              <Row key={l.id} label={`${l.categoryName} · ${l.description}`} value="DA QUOTARE" muted />
            ))}
          </div>
        )}
      </Section>

      <Section n={4} title="Struttura finanziaria">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-slate-400">Capitale proprio e investitori</p>
            {bp.data.partners.map((p) => (
              <Row key={p.id} label={`${p.name} (${p.profitSharePct}% degli utili)`} value={formatCurrency(p.contributionAmount)} muted />
            ))}
            {bp.data.partners.length === 0 && <p className="py-1.5 text-sm text-slate-400">Nessun capitale proprio inserito.</p>}
            <p className="mb-1 mt-4 text-xs font-medium uppercase text-slate-400">Finanziamenti</p>
            {bp.data.loans.map((l) => (
              <Row
                key={l.id}
                label={`${l.name} · ${LOAN_TYPE_LABEL[l.type]}, ${l.annualInterestRatePct}% per ${l.durationMonths} mesi, ${AMORTIZATION_LABEL[l.amortizationType]}`}
                value={formatCurrency(l.principalAmount)}
                muted
              />
            ))}
            {bp.data.loans.length === 0 && <p className="py-1.5 text-sm text-slate-400">Nessun finanziamento.</p>}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-slate-400">Copertura del fabbisogno</p>
            <Row label="Fabbisogno massimo di cassa" value={formatCurrency(cashFlow.peakFundingNeed)} muted />
            <Row label={`raggiunto al mese`} value={String(cashFlow.peakFundingMonth)} muted />
            <Row label="Capitale proprio versato" value={formatCurrency(kpis.equityInvested)} muted />
            <Row label="Finanziamenti" value={formatCurrency(loanTotal)} muted />
            <Row
              label={cashFlow.equityHeadroom >= 0 ? "Margine di sicurezza" : "Capitale mancante"}
              value={formatCurrency(Math.abs(cashFlow.equityHeadroom))}
              strong
            />
            <Row label="Interessi totali sui finanziamenti" value={formatCurrency(f.holding.loanInterestTotal)} muted />
          </div>
        </div>
      </Section>

      <Section n={5} title="Conto economico dell'operazione" subtitle={bp.data.deal.costsVatRecoverable ? "Costi al netto IVA (IVA recuperabile)." : "Costi IVA inclusa (IVA non recuperabile)."}>
        <div className="max-w-xl">
          <Row label="Ricavo di vendita" value={formatCurrency(kpis.salePrice)} strong />
          <Row label="− Costi di vendita (agenzia, marketing, chiusura)" value={formatCurrency(kpis.saleCosts)} muted />
          <Row label="− Acquisizione" value={formatCurrency(f.totals.totalAcquisitionCost)} muted />
          <Row label="− Lavori (imprevisti inclusi)" value={formatCurrency(f.totals.totalRenovationCost)} muted />
          <Row label="− Enti esterni" value={formatCurrency(f.totals.totalEntiEsterniCost)} muted />
          <Row label="− Altro" value={formatCurrency(f.totals.totalAltroCost)} muted />
          <Row label="− Detenzione (costi fissi)" value={formatCurrency(f.holding.nonLoanTotal)} muted />
          <Row label="− Oneri finanziari" value={formatCurrency(f.holding.loanInterestTotal)} muted />
          <Row label="Margine lordo" value={formatCurrency(kpis.grossMargin)} strong />
          <Row
            label={`− Imposte stimate (${REGIME_LABEL[bp.data.deal.regimeType ?? "ALTRO"]})`}
            value={formatCurrency(kpis.taxes)}
            muted
          />
          <Row label="Margine netto" value={formatCurrency(kpis.netMargin)} strong />
        </div>
      </Section>

      <Section n={6} title="Indicatori">
        <div className="grid gap-x-8 sm:grid-cols-2">
          <div>
            <Row label="ROI (margine netto / costo totale)" value={formatPercent(kpis.roi)} />
            <Row label="ROE (margine netto / capitale proprio)" value={pct(kpis.roe)} />
            <Row label="Margine sul prezzo di vendita" value={formatPercent(kpis.marginOnRevenue)} />
          </div>
          <div>
            <Row label="Durata" value={`${kpis.durationMonths} mesi`} />
            <Row label="Rendimento annualizzato (1+ROI)^(12/mesi)−1" value={formatPercent(kpis.annualizedRoi)} />
            <Row label="ROE annualizzato" value={pct(kpis.annualizedRoe)} />
          </div>
        </div>
      </Section>

      <Section
        n={7}
        title="Cash flow mensile"
        subtitle={`Lavori ripartiti su ${cashFlow.renovationMonths} mesi di cantiere, vendita al mese ${cashFlow.saleMonth}. Capitale proprio escluso: il punto più basso del cumulato è il capitale da raccogliere.`}
      >
        <div className="mb-4 print:hidden">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cashFlow.months}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} tickFormatter={(m) => `M${m}`} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} width={90} />
              <Tooltip formatter={(v: number) => formatCurrency(v, true)} labelFormatter={(m) => `Mese ${m}`} />
              <Bar dataKey="cumulative" name="Cumulato" radius={[3, 3, 0, 0]}>
                {cashFlow.months.map((m) => (
                  <Cell key={m.month} fill={m.cumulative >= 0 ? "#059669" : "#dc2626"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-right uppercase text-slate-400">
                <th className="py-2 pr-2 text-left">Mese</th>
                <th className="py-2 pr-2">Acquisto</th>
                <th className="py-2 pr-2">Lavori</th>
                <th className="py-2 pr-2">Detenzione</th>
                <th className="py-2 pr-2">Finanz. erogati</th>
                <th className="py-2 pr-2">Interessi</th>
                <th className="py-2 pr-2">Rimborso capitale</th>
                <th className="py-2 pr-2">Vendita netta</th>
                <th className="py-2 pr-2">Imposte</th>
                <th className="py-2 pr-2">Netto</th>
                <th className="py-2 pr-2">Cumulato</th>
              </tr>
            </thead>
            <tbody>
              {cashFlow.months.map((m) => (
                <tr key={m.month} className="border-b border-slate-100 text-right">
                  <td className="py-1.5 pr-2 text-left">{m.month}</td>
                  <td className="py-1.5 pr-2">{m.acquisition ? formatCurrency(-m.acquisition) : ""}</td>
                  <td className="py-1.5 pr-2">{m.renovation ? formatCurrency(-m.renovation) : ""}</td>
                  <td className="py-1.5 pr-2">{m.holding ? formatCurrency(-m.holding) : ""}</td>
                  <td className="py-1.5 pr-2">{m.loanDisbursement ? formatCurrency(m.loanDisbursement) : ""}</td>
                  <td className="py-1.5 pr-2">{m.loanInterest ? formatCurrency(-m.loanInterest) : ""}</td>
                  <td className="py-1.5 pr-2">{m.loanPrincipal ? formatCurrency(-m.loanPrincipal) : ""}</td>
                  <td className="py-1.5 pr-2">{m.saleNet ? formatCurrency(m.saleNet) : ""}</td>
                  <td className="py-1.5 pr-2">{m.taxes ? formatCurrency(-m.taxes) : ""}</td>
                  <td className="py-1.5 pr-2 font-medium">{formatCurrency(m.net)}</td>
                  <td className={`py-1.5 pr-2 font-medium ${m.cumulative < 0 ? "text-red-700" : "text-emerald-700"}`}>
                    {formatCurrency(m.cumulative)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section n={8} title="Scenari e sensitivity" subtitle="Pessimistico: prezzo −10%, lavori +15%, tempi +3 mesi. Ottimistico: prezzo +5%.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-right text-xs uppercase text-slate-400">
                <th className="py-2 pr-4 text-left" />
                {plan.scenarios.map((s) => (
                  <th key={s.key} className="py-2 pr-4">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Prezzo di vendita", (k) => formatCurrency(k.salePrice)],
                  ["Costo totale", (k) => formatCurrency(k.totalProjectCost)],
                  ["Margine netto", (k) => formatCurrency(k.netMargin)],
                  ["ROI", (k) => formatPercent(k.roi)],
                  ["ROE", (k) => pct(k.roe)],
                  ["Durata", (k) => `${k.durationMonths} mesi`],
                  ["Rendimento annualizzato", (k) => formatPercent(k.annualizedRoi)],
                ] as Array<[string, (k: typeof kpis) => string]>
              ).map(([label, fmt]) => (
                <tr key={label} className="border-b border-slate-100 text-right">
                  <td className="py-1.5 pr-4 text-left text-slate-600">{label}</td>
                  {plan.scenarios.map((s) => (
                    <td key={s.key} className={`py-1.5 pr-4 font-medium ${label === "Margine netto" && s.kpis.netMargin < 0 ? "text-red-700" : ""}`}>
                      {fmt(s.kpis)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mb-1 mt-5 text-xs font-medium uppercase text-slate-400">Una variabile alla volta</p>
        <div className="max-w-xl">
          {plan.stressTests.map((t) => (
            <Row
              key={t.label}
              label={t.label}
              value={`${formatCurrency(t.netMargin)} (${t.deltaVsBase >= 0 ? "+" : ""}${formatCurrency(t.deltaVsBase)}) · ROI ${formatPercent(t.roi)}`}
              muted
            />
          ))}
        </div>
      </Section>

      <Section n={9} title="Rischi e punti di attenzione">
        {risks.length === 0 ? (
          <p className="text-sm text-slate-400">Nessun punto di attenzione rilevato dai dati del deal.</p>
        ) : (
          <ul className="grid gap-2">
            {risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-0.5 print:hidden">
                  <Badge tone={r.tone}>{r.tone === "danger" ? "Critico" : r.tone === "warning" ? "Avviso" : "Nota"}</Badge>
                </span>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
