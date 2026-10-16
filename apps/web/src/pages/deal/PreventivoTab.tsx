import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatCurrency } from "../../lib/format";
import type { DealDetail } from "../../lib/types";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Input, Label } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { clientBasePrice, quoteVatRatePct } from "./RenovationTab";
import logoUrl from "../../assets/housetohome-logo.jpg";

export function formatDateIt(value: string | Date): string {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

/**
 * Preventivo da dare al cliente per un deal RISTRUTTURAZIONE_CLIENTE, nel
 * formato del modulo House to Home Srl usato finora (stessa intestazione,
 * stesso logo, stessi colori, stesso riquadro condizioni/pagamento in
 * fondo). Le voci di costo restano quelle già gestite dall'app: prezzo già
 * maggiorato (impostato nella scheda Ristrutturazione, o costo + ricarico %
 * per Materiali/Lavorazioni), senza IVA per voce — l'IVA si applica una
 * sola volta sul totale, con l'aliquota impostata qui sotto.
 */
export default function PreventivoTab({ deal }: { deal: DealDetail }) {
  const utils = trpc.useUtils();
  const [vatPct, setVatPct] = useState(quoteVatRatePct(deal).toString());
  const saveVat = trpc.dealSettings.updateRenovationSettings.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });
  const toggleUnifyMaterials = trpc.dealSettings.updateRenovationSettings.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });
  const unifyMaterials = deal.renovationSettings?.unifyMaterialPricesInQuote ?? false;

  const items = deal.costLineItems.filter((i) => !i.isMemo);
  const rows = items.map((item) => ({ item, price: clientBasePrice(item, deal) }));
  const subtotal = rows.reduce((sum, r) => sum + r.price, 0);
  const currentVatPct = quoteVatRatePct(deal);
  const vatAmount = (subtotal * currentVatPct) / 100;
  const grandTotal = subtotal + vatAmount;
  const materialsTotal = rows
    .filter((r) => r.item.category.group === "MATERIALI")
    .reduce((sum, r) => sum + r.price, 0);

  const acconto1 = grandTotal * 0.25;
  const acconto2 = grandTotal * 0.5;
  const saldo = grandTotal - acconto1 - acconto2;

  const quoteStatusLabel = deal.status === "ACQUISIZIONE" ? "confermato" : "in attesa di conferma";

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <p className="text-sm text-slate-500">
          Elenca le voci di costo con il prezzo già maggiorato (impostato nella scheda Ristrutturazione, o costo +
          ricarico % per Materiali/Lavorazioni), senza IVA per voce. Non mostra dati interni come pagato/residuo.
        </p>
        <Button variant="secondary" onClick={() => window.print()}>
          Stampa preventivo
        </Button>
      </div>

      <Card className="print:hidden">
        <CardHeader
          title="IVA del preventivo"
          subtitle="Un'unica aliquota sul totale: 10% per i privati (ristrutturazione edilizia), 22% per le società."
        />
        <CardBody className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="quoteVat">IVA (%)</Label>
            <Input id="quoteVat" type="number" className="w-28" value={vatPct} onChange={(e) => setVatPct(e.target.value)} />
          </div>
          <Button
            variant="secondary"
            disabled={saveVat.isPending}
            onClick={() =>
              saveVat.mutate({
                dealId: deal.id,
                contingencyPct: deal.renovationSettings?.contingencyPct ?? 12,
                materialMarkupPct: deal.renovationSettings?.materialMarkupPct,
                laborMarkupPct: deal.renovationSettings?.laborMarkupPct,
                quoteVatRatePct: Number(vatPct),
              })
            }
          >
            Salva
          </Button>
        </CardBody>
      </Card>

      <Card className="print:hidden">
        <CardHeader
          title="Prezzi materiali nel preventivo"
          subtitle="Con il prezzo unificato, ogni voce materiale resta elencata (così il cliente vede cosa è incluso) ma senza un prezzo per singolo articolo: solo un totale unico a fine gruppo."
        />
        <CardBody>
          <Button
            variant="secondary"
            disabled={toggleUnifyMaterials.isPending}
            onClick={() =>
              toggleUnifyMaterials.mutate({
                dealId: deal.id,
                contingencyPct: deal.renovationSettings?.contingencyPct ?? 12,
                materialMarkupPct: deal.renovationSettings?.materialMarkupPct,
                laborMarkupPct: deal.renovationSettings?.laborMarkupPct,
                quoteVatRatePct: deal.renovationSettings?.quoteVatRatePct,
                unifyMaterialPricesInQuote: !unifyMaterials,
              })
            }
          >
            {unifyMaterials ? "Mostra prezzo per ogni voce materiale" : "Unifica prezzo materiali"}
          </Button>
        </CardBody>
      </Card>

      {/* Documento stampabile: stessa intestazione/colori/logo del modulo House to Home Srl. */}
      <div className="bg-white p-6 text-[11px] leading-snug text-slate-800 shadow-sm print:p-10 print:shadow-none">
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
            <div className="inline-block bg-cyan-400 px-3 py-0.5 font-semibold text-white">Spett.le</div>
            <div className="mt-1">{deal.clientName}</div>
            <div>{deal.clientAddress || deal.address}</div>
            <div className="mt-4">Data: {deal.quoteDate ? formatDateIt(deal.quoteDate) : formatDateIt(new Date())}</div>
            <div>Preventivo: {quoteStatusLabel}</div>
            {deal.quoteValidUntil && <div>Valido fino al: {formatDateIt(deal.quoteValidUntil)}</div>}
          </div>
        </div>

        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="bg-cyan-400 text-left text-white">
              <th className="border border-slate-300 px-2 py-1">DESCRIZIONE LAVORI</th>
              <th className="border border-slate-300 px-2 py-1 text-right">MQ</th>
              <th className="border border-slate-300 px-2 py-1 text-right">PREZZO</th>
              <th className="border border-slate-300 px-2 py-1 text-right">QTÀ</th>
              <th className="border border-slate-300 px-2 py-1 text-right">
                TOTALE
                <br />€
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, price }) => {
              const hidePrice = unifyMaterials && item.category.group === "MATERIALI";
              const qty = item.quantity ?? null;
              const unitPrice = qty ? price / qty : null;
              const isMq = item.unit === "mq";
              return (
                <tr key={item.id}>
                  <td className="border border-slate-300 px-2 py-1">{item.description}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right">{qty && isMq ? qty : ""}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right">
                    {!hidePrice && unitPrice !== null ? formatCurrency(unitPrice, true) : ""}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-right">
                    {qty && !isMq ? `${qty}${item.unit ? ` ${item.unit}` : ""}` : ""}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-right">
                    {hidePrice ? "" : formatCurrency(price, true)}
                  </td>
                </tr>
              );
            })}
            {unifyMaterials && materialsTotal > 0 && (
              <tr className="font-semibold">
                <td className="border border-slate-300 px-2 py-1 text-right" colSpan={4}>
                  Totale materiale
                </td>
                <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(materialsTotal, true)}</td>
              </tr>
            )}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="border border-slate-300 px-2 py-6 text-center text-slate-400">
                  Nessuna voce ancora inserita nella scheda Ristrutturazione.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {rows.length > 0 && (
          <table className="w-full border-collapse">
            <tbody>
              <tr className="bg-cyan-400 font-bold italic text-white">
                <td className="border border-slate-300 px-2 py-1">TOTALE</td>
                <td className="border border-slate-300 px-2 py-1">{formatCurrency(grandTotal, true)}</td>
                <td className="border border-slate-300 px-2 py-1" colSpan={3}>
                  + {currentVatPct}% di IVA
                </td>
              </tr>
              <tr className="bg-cyan-400 font-semibold italic text-white">
                <td className="border border-slate-300 px-2 py-1" colSpan={2}>
                  Condizioni
                </td>
                <td className="border border-slate-300 px-2 py-1" colSpan={3}>
                  Pagamento
                </td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-2 py-2 align-top" colSpan={2}>
                  Gentile cliente,
                  <br />
                  con l'accettazione del presente preventivo, viene richiesto un acconto pari al 25% del totale
                  preventivo ({formatCurrency(acconto1, true)}) alla conferma del preventivo.
                  <br />
                  Un secondo acconto del 50% del totale preventivo ({formatCurrency(acconto2, true)}) a metà lavori.
                  <br />
                  Saldo ({formatCurrency(saldo, true)}) a fine lavori.
                  <br />
                  Inoltre, dichiara di aver verificato e approvato i costi per le opere descritte all'impresa
                  incaricata all'esecuzione dei lavori.
                </td>
                <td className="border border-slate-300 px-2 py-2 align-top" colSpan={3}>
                  BANCA DI BOLOGNA
                  <br />
                  IBAN: IT53 W 08883 02406 029000294064
                  <br />
                  BIC: CCRT IT 2T BDB
                  <br />
                  INTESTAZIONE: HOUSETOHOME SRL
                  <div className="mt-6 text-center font-medium">DATA E FIRMA PER ACCETTAZIONE</div>
                  <div className="mt-10 border-t border-slate-400" />
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
