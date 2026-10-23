import { useEffect, useRef, useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatCurrency, formatPercent } from "../../lib/format";
import type { DealDetail, CostLineItemDetail } from "../../lib/types";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Field";
import { downloadElementAsPdf } from "../../lib/pdf";
import logoUrl from "../../assets/housetohome-logo.jpg";
import { formatDateIt } from "./PreventivoTab";

const SCENARIO_LABEL: Record<string, string> = { PRUDENTE: "Prudente", REALISTICO: "Realistico", OTTIMISTICO: "Ottimistico" };

function rowTotal(item: CostLineItemDetail): number {
  return item.taxableAmount + (item.taxableAmount * item.vatRatePct) / 100 + item.nonTaxableAmount;
}

/**
 * Business plan stampabile del flip: dati fondamentali per una banca/socio,
 * non ogni singola voce di cantiere (quelle restano nella scheda
 * Ristrutturazione). Struttura basata sui modelli già in uso dall'utente:
 * - Acquisizione e Detenzione: voci singole (sono poche, utile vederle tutte).
 * - Materiale: un unico totale (troppe voci per elencarle tutte).
 * - Lavorazioni: un totale per fornitore ("vedi contratto"), non ogni task.
 * - Enti esterni: voci singole (sono poche).
 * - Riepilogo finale: costo operazione, rivendita, guadagno (ripartito per
 *   socio se impostati in Finanziamento), credito IVA se recuperabile.
 */
export default function BusinessPlanTab({ deal }: { deal: DealDetail }) {
  const [scenario, setScenario] = useState<"PRUDENTE" | "REALISTICO" | "OTTIMISTICO">("REALISTICO");
  const results = trpc.results.forDeal.useQuery({ dealId: deal.id, scenario });
  const [downloading, setDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Nessuno stato di "printing" da resettare: è un documento unico, non per fornitore.
  }, []);

  if (!results.data?.result) {
    return (
      <p className="text-sm text-slate-500">
        Dati incompleti per generare il business plan: completa acquisizione, fiscalità, detenzione e almeno lo
        scenario di vendita selezionato.
      </p>
    );
  }
  const r = results.data.result;

  const acquisizioneItems = deal.costLineItems.filter((i) => !i.isMemo && i.category.group === "ACQUISIZIONE");
  const entiEsterniItems = deal.costLineItems.filter((i) => !i.isMemo && i.category.group === "ENTI_ESTERNI");
  const altroItems = deal.costLineItems.filter((i) => !i.isMemo && i.category.group === "ALTRO");

  const lavorazioniItems = deal.costLineItems.filter((i) => !i.isMemo && i.vendor && i.category.group === "LAVORAZIONI");
  const byVendor = new Map<string, { name: string; total: number }>();
  for (const item of lavorazioniItems) {
    const vendor = item.vendor!;
    const g = byVendor.get(vendor.id) ?? { name: vendor.name, total: 0 };
    g.total += rowTotal(item);
    byVendor.set(vendor.id, g);
  }
  const vendorTotals = [...byVendor.values()].sort((a, b) => a.name.localeCompare(b.name));
  const lavorazioniSenzaFornitore = deal.costLineItems
    .filter((i) => !i.isMemo && !i.vendor && i.category.group === "LAVORAZIONI")
    .reduce((sum, i) => sum + rowTotal(i), 0);

  const saleScenarioRow = deal.saleScenarios.find((s) => s.scenario === scenario);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-end gap-3 print:hidden">
        <span className="mr-auto text-sm text-slate-500">Scenario:</span>
        <Select className="max-w-xs" value={scenario} onChange={(e) => setScenario(e.target.value as typeof scenario)}>
          {Object.entries(SCENARIO_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Button variant="secondary" onClick={() => window.print()}>
          Stampa business plan
        </Button>
        <Button
          variant="secondary"
          disabled={downloading}
          onClick={async () => {
            const el = printRef.current;
            if (!el) return;
            setDownloading(true);
            try {
              await downloadElementAsPdf(el, `Business plan ${deal.name}.pdf`);
            } finally {
              setDownloading(false);
            }
          }}
        >
          {downloading ? "Generazione PDF..." : "Scarica PDF"}
        </Button>
      </div>

      <div
        ref={printRef}
        className="bg-white p-6 text-[11px] leading-snug text-slate-800 shadow-sm print:p-10 print:shadow-none"
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-bold tracking-wide">HOUSETOHOME SRL</h1>
            <div className="mt-3 space-y-0.5">
              <div>P.IVA 04269211209</div>
              <div>VIA SANTO STEFANO 97</div>
              <div>BOLOGNA 40125</div>
              <div>PEC: housetohome89@pec.it</div>
              <div>MAIL: housetohomesrl@gmail.com</div>
              <div>TEL: +39 3395829835</div>
            </div>
          </div>
          <img src={logoUrl} alt="House to Home Srl" className="h-24 shrink-0" />
          <div className="w-56 shrink-0 text-right">
            <div className="inline-block bg-cyan-400 px-3 py-0.5 font-semibold text-white">Business plan</div>
            <div className="mt-1 font-medium">{deal.address || deal.name}</div>
            <div className="mt-1 text-slate-500">Scenario {SCENARIO_LABEL[scenario]}</div>
            <div className="mt-4">Data: {formatDateIt(new Date())}</div>
          </div>
        </div>

        {/* Spese di acquisizione */}
        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="bg-cyan-400 text-left text-white">
              <th className="border border-slate-300 px-2 py-1" colSpan={2}>
                SPESE DI ACQUISIZIONE
              </th>
            </tr>
          </thead>
          <tbody>
            {acquisizioneItems.length === 0 ? (
              <tr>
                <td className="border border-slate-300 px-2 py-1 text-slate-400" colSpan={2}>
                  Nessuna voce.
                </td>
              </tr>
            ) : (
              acquisizioneItems.map((item) => (
                <tr key={item.id}>
                  <td className="border border-slate-300 px-2 py-1">{item.description}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(rowTotal(item), true)}</td>
                </tr>
              ))
            )}
            <tr className="font-bold">
              <td className="border border-slate-300 px-2 py-1">TOTALE ACQUISIZIONE</td>
              <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(r.totals.totalAcquisitionCost, true)}</td>
            </tr>
          </tbody>
        </table>

        {/* Spese di detenzione */}
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="bg-cyan-400 text-left text-white">
              <th className="border border-slate-300 px-2 py-1" colSpan={2}>
                SPESE DI DETENZIONE ({deal.holdingCosts?.durationMonths ?? 0} mesi)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-300 px-2 py-1">Assicurazione, utenze, IMU, spese condominiali</td>
              <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(r.holding.nonLoanTotal, true)}</td>
            </tr>
            {r.holding.loanInterestTotal > 0 && (
              <tr>
                <td className="border border-slate-300 px-2 py-1">Interessi finanziamenti del deal (scheda Finanziamento)</td>
                <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(r.holding.loanInterestTotal, true)}</td>
              </tr>
            )}
            {r.holding.externalFinancingCost > 0 && (
              <tr>
                <td className="border border-slate-300 px-2 py-1">Rata finanziamenti aziendali (Mutuo/Prestito)</td>
                <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(r.holding.externalFinancingCost, true)}</td>
              </tr>
            )}
            <tr className="font-bold">
              <td className="border border-slate-300 px-2 py-1">TOTALE DETENZIONE</td>
              <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(r.holding.total, true)}</td>
            </tr>
          </tbody>
        </table>

        {/* Materiale */}
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="bg-cyan-400 text-left text-white">
              <th className="border border-slate-300 px-2 py-1" colSpan={2}>
                MATERIALE
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="font-bold">
              <td className="border border-slate-300 px-2 py-1">TOTALE MATERIALE</td>
              <td className="border border-slate-300 px-2 py-1 text-right">
                {formatCurrency(r.costs.byGroup.MATERIALI.totalWithVat, true)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Lavorazioni per fornitore */}
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="bg-cyan-400 text-left text-white">
              <th className="border border-slate-300 px-2 py-1">LAVORAZIONI (per fornitore, vedi contratto)</th>
              <th className="border border-slate-300 px-2 py-1 text-right">TOTALE €</th>
            </tr>
          </thead>
          <tbody>
            {vendorTotals.length === 0 && lavorazioniSenzaFornitore === 0 ? (
              <tr>
                <td className="border border-slate-300 px-2 py-1 text-slate-400" colSpan={2}>
                  Nessuna voce.
                </td>
              </tr>
            ) : (
              <>
                {vendorTotals.map((v) => (
                  <tr key={v.name}>
                    <td className="border border-slate-300 px-2 py-1">{v.name}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(v.total, true)}</td>
                  </tr>
                ))}
                {lavorazioniSenzaFornitore > 0 && (
                  <tr>
                    <td className="border border-slate-300 px-2 py-1">Senza fornitore assegnato</td>
                    <td className="border border-slate-300 px-2 py-1 text-right">
                      {formatCurrency(lavorazioniSenzaFornitore, true)}
                    </td>
                  </tr>
                )}
              </>
            )}
            <tr className="font-bold">
              <td className="border border-slate-300 px-2 py-1">TOTALE LAVORAZIONI</td>
              <td className="border border-slate-300 px-2 py-1 text-right">
                {formatCurrency(r.costs.byGroup.LAVORAZIONI.totalWithVat, true)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Enti esterni */}
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="bg-cyan-400 text-left text-white">
              <th className="border border-slate-300 px-2 py-1" colSpan={2}>
                COSTI ENTI ESTERNI
              </th>
            </tr>
          </thead>
          <tbody>
            {entiEsterniItems.length === 0 ? (
              <tr>
                <td className="border border-slate-300 px-2 py-1 text-slate-400" colSpan={2}>
                  Nessuna voce.
                </td>
              </tr>
            ) : (
              entiEsterniItems.map((item) => (
                <tr key={item.id}>
                  <td className="border border-slate-300 px-2 py-1">{item.description}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(rowTotal(item), true)}</td>
                </tr>
              ))
            )}
            <tr className="font-bold">
              <td className="border border-slate-300 px-2 py-1">TOTALE ENTI ESTERNI</td>
              <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(r.totals.totalEntiEsterniCost, true)}</td>
            </tr>
          </tbody>
        </table>

        {/* Altro (solo se presente) */}
        {altroItems.length > 0 && (
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr className="bg-cyan-400 text-left text-white">
                <th className="border border-slate-300 px-2 py-1" colSpan={2}>
                  ALTRO / VARIE
                </th>
              </tr>
            </thead>
            <tbody>
              {altroItems.map((item) => (
                <tr key={item.id}>
                  <td className="border border-slate-300 px-2 py-1">{item.description}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(rowTotal(item), true)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="border border-slate-300 px-2 py-1">TOTALE ALTRO</td>
                <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(r.totals.totalAltroCost, true)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Riepilogo finale */}
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="bg-cyan-400 text-left text-white">
              <th className="border border-slate-300 px-2 py-1" colSpan={2}>
                RIEPILOGO
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="font-bold">
              <td className="border border-slate-300 px-2 py-1">TOTALE COSTI OPERAZIONE</td>
              <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(r.totals.totalProjectCost, true)}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 px-2 py-1">Prezzo di rivendita (imponibile)</td>
              <td className="border border-slate-300 px-2 py-1 text-right">
                {formatCurrency(r.sourcesAndUses.saleProceeds, true)}
              </td>
            </tr>
            {r.sale.saleVatAmount > 0 && (
              <tr>
                <td className="border border-slate-300 px-2 py-1">IVA su vendita ({saleScenarioRow?.vatRatePct ?? 0}%)</td>
                <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(r.sale.saleVatAmount, true)}</td>
              </tr>
            )}
            <tr>
              <td className="border border-slate-300 px-2 py-1">Costi di vendita (agenzia, marketing, chiusura)</td>
              <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(r.sale.saleCosts, true)}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 px-2 py-1">Imposte sull'operazione</td>
              <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(r.taxes.totalTax, true)}</td>
            </tr>
            <tr className="bg-cyan-400 font-bold italic text-white">
              <td className="border border-slate-300 px-2 py-1">GUADAGNO (UTILE NETTO)</td>
              <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(r.sale.netProfit, true)}</td>
            </tr>
            {deal.partners.length > 0 &&
              deal.partners.map((p) => (
                <tr key={p.id}>
                  <td className="border border-slate-300 px-2 py-1">
                    Guadagno {p.name}: {formatPercent(p.profitSharePct / 100)}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-right">
                    {formatCurrency((r.sale.netProfit * p.profitSharePct) / 100, true)}
                  </td>
                </tr>
              ))}
            {deal.acquisitionDetails && deal.acquisitionDetails.ownStakePct < 100 && (
              <tr>
                <td className="border border-slate-300 px-2 py-1">
                  Guadagno a carico nostro: {formatPercent(deal.acquisitionDetails.ownStakePct / 100)}
                </td>
                <td className="border border-slate-300 px-2 py-1 text-right">
                  {formatCurrency((r.sale.netProfit * deal.acquisitionDetails.ownStakePct) / 100, true)}
                </td>
              </tr>
            )}
            {r.sale.vatCredit > 0 && (
              <tr>
                <td className="border border-slate-300 px-2 py-1">Credito IVA generato dall'operazione</td>
                <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(r.sale.vatCredit, true)}</td>
              </tr>
            )}
            <tr>
              <td className="border border-slate-300 px-2 py-1">ROI (utile netto / costo totale)</td>
              <td className="border border-slate-300 px-2 py-1 text-right">{formatPercent(r.kpis.roi)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
