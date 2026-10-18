import { Fragment, useRef, useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatCurrency } from "../../lib/format";
import type { DealDetail } from "../../lib/types";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Input, Label, Select } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { clientBasePrice, quoteVatRatePct } from "./RenovationTab";
import { downloadElementAsPdf } from "../../lib/pdf";
import logoUrl from "../../assets/housetohome-logo.jpg";

export function formatDateIt(value: string | Date): string {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

const QUOTE_STATUS_LABEL: Record<string, string> = {
  BOZZA: "Bozza",
  INVIATO: "Inviato",
  ACCETTATO: "Accettato",
  RIFIUTATO: "Rifiutato",
};

const QUOTE_STATUS_PRINT_LABEL: Record<string, string> = {
  BOZZA: "in attesa di conferma",
  INVIATO: "inviato, in attesa di conferma",
  ACCETTATO: "confermato",
  RIFIUTATO: "rifiutato",
};

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
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [vatPct, setVatPct] = useState(quoteVatRatePct(deal).toString());
  const saveVat = trpc.dealSettings.updateRenovationSettings.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });
  const toggleUnifyMaterials = trpc.dealSettings.updateRenovationSettings.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });
  const unifyMaterials = deal.renovationSettings?.unifyMaterialPricesInQuote ?? false;

  const updateQuoteStatus = trpc.deal.update.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });
  const snapshots = trpc.quoteSnapshot.list.useQuery({ dealId: deal.id });
  const createSnapshot = trpc.quoteSnapshot.create.useMutation({
    onSuccess: () => utils.quoteSnapshot.list.invalidate({ dealId: deal.id }),
  });
  const deleteSnapshot = trpc.quoteSnapshot.delete.useMutation({
    onSuccess: () => utils.quoteSnapshot.list.invalidate({ dealId: deal.id }),
  });
  const [expandedSnapshotId, setExpandedSnapshotId] = useState<string | null>(null);

  const items = deal.costLineItems.filter((i) => !i.isMemo);
  const rows = items.map((item) => ({ item, price: clientBasePrice(item, deal) }));
  // L'allestimento cantiere va sempre stampato come ultima voce, qualunque
  // sia il suo ordine tra le altre voci di costo del deal.
  const isAllestimentoCantiere = (description: string) => {
    const d = description.toLowerCase();
    return d.includes("allestimento") && d.includes("cantiere");
  };
  const printRows = [...rows].sort(
    (a, b) => Number(isAllestimentoCantiere(a.item.description)) - Number(isAllestimentoCantiere(b.item.description)),
  );
  const subtotal = rows.reduce((sum, r) => sum + r.price, 0);
  const currentVatPct = quoteVatRatePct(deal);
  const vatAmount = (subtotal * currentVatPct) / 100;
  const grandTotal = subtotal + vatAmount;
  const materialsTotal = rows
    .filter((r) => r.item.category.group === "MATERIALI")
    .reduce((sum, r) => sum + r.price, 0);
  // Indice dell'ultima voce Materiali nell'ordine stampato: la riga
  // "Totale materiale" va subito dopo, non in fondo a tutto il documento.
  const lastMaterialIndex = printRows.reduce(
    (last, r, i) => (r.item.category.group === "MATERIALI" ? i : last),
    -1,
  );

  const acconto1 = grandTotal * 0.25;
  const acconto2 = grandTotal * 0.5;
  const saldo = grandTotal - acconto1 - acconto2;

  // Il deal ha anche uno stato "pipeline" più vecchio (VALUTAZIONE/ACQUISIZIONE,
  // mostrato nel Portafoglio come "Preventivo per cliente"/"Preventivo
  // confermato"): per i deal confermati PRIMA che esistesse questo campo
  // dedicato, quoteStatus è rimasto sul default "Bozza". Finché non viene
  // scelto esplicitamente un altro stato, lo deduciamo da lì per non mostrare
  // due stati diversi per la stessa cosa.
  const effectiveQuoteStatus =
    deal.status === "ACQUISIZIONE" && deal.quoteStatus === "BOZZA" ? "ACCETTATO" : deal.quoteStatus;
  const quoteStatusLabel = QUOTE_STATUS_PRINT_LABEL[effectiveQuoteStatus] ?? QUOTE_STATUS_PRINT_LABEL.BOZZA;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const validUntil = deal.quoteValidUntil ? new Date(deal.quoteValidUntil) : null;
  const daysToExpiry = validUntil ? Math.ceil((validUntil.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isExpired = deal.quoteStatus === "INVIATO" && daysToExpiry !== null && daysToExpiry < 0;
  const isExpiringSoon = deal.quoteStatus === "INVIATO" && daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 7;

  function saveSnapshot() {
    createSnapshot.mutate({
      dealId: deal.id,
      grandTotal,
      vatRatePct: currentVatPct,
      items: printRows.map(({ item, price }) => ({
        description: item.description,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        price,
        cost: item.taxableAmount + item.nonTaxableAmount,
      })),
    });
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <p className="text-sm text-slate-500">
          Elenca le voci di costo con il prezzo già maggiorato (impostato nella scheda Ristrutturazione, o costo +
          ricarico % per Materiali/Lavorazioni), senza IVA per voce. Non mostra dati interni come pagato/residuo.
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              saveSnapshot();
              window.print();
            }}
          >
            Stampa preventivo
          </Button>
          <Button
            variant="secondary"
            disabled={downloading}
            onClick={async () => {
              if (!printRef.current) return;
              saveSnapshot();
              setDownloading(true);
              try {
                await downloadElementAsPdf(printRef.current, `Preventivo ${deal.name}.pdf`);
              } finally {
                setDownloading(false);
              }
            }}
          >
            {downloading ? "Generazione PDF..." : "Scarica PDF"}
          </Button>
        </div>
      </div>

      {(isExpired || isExpiringSoon) && (
        <div
          className={`rounded-md border px-4 py-2 text-sm print:hidden ${
            isExpired ? "border-red-300 bg-red-50 text-red-700" : "border-amber-300 bg-amber-50 text-amber-700"
          }`}
        >
          {isExpired
            ? `Preventivo inviato e scaduto il ${formatDateIt(validUntil!)} (nessuna risposta dal cliente): valuta se aggiornare la validità o lo stato.`
            : `Preventivo inviato, in scadenza tra ${daysToExpiry} giorn${daysToExpiry === 1 ? "o" : "i"} (${formatDateIt(validUntil!)}).`}
        </div>
      )}

      <Card className="print:hidden">
        <CardHeader
          title="Stato preventivo"
          subtitle='Avanzamento verso il cliente: bozza, inviato, accettato o rifiutato. Collegato al pulsante "Preventivo confermato" nel Portafoglio — confermarlo da lì imposta anche questo su Accettato.'
        />
        <CardBody className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="quoteStatus">Stato</Label>
            <Select
              id="quoteStatus"
              className="w-48"
              value={effectiveQuoteStatus}
              onChange={(e) => updateQuoteStatus.mutate({ id: deal.id, quoteStatus: e.target.value as DealDetail["quoteStatus"] })}
            >
              {Object.entries(QUOTE_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

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
      <div ref={printRef} className="bg-white p-6 text-[11px] leading-snug text-slate-800 shadow-sm print:p-10 print:shadow-none">
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
            {printRows.map(({ item, price }, i) => {
              const hidePrice = unifyMaterials && item.category.group === "MATERIALI";
              const qty = item.quantity ?? null;
              const unitPrice = qty ? price / qty : null;
              const isMq = item.unit === "mq";
              return (
                <Fragment key={item.id}>
                  <tr>
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
                  {unifyMaterials && i === lastMaterialIndex && materialsTotal > 0 && (
                    <tr className="font-semibold">
                      <td className="border border-slate-300 px-2 py-1 text-right" colSpan={4}>
                        Totale materiale
                      </td>
                      <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(materialsTotal, true)}</td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
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

      <Card className="print:hidden">
        <CardHeader
          title="Storico versioni"
          subtitle="Uno snapshot viene salvato automaticamente ogni volta che stampi o scarichi il PDF, per confrontare cosa è stato proposto al cliente nel tempo."
        />
        <CardBody>
          {(snapshots.data ?? []).length === 0 && (
            <p className="text-sm text-slate-400">Nessuna versione salvata ancora: stampa o scarica il preventivo per crearne una.</p>
          )}
          <div className="grid gap-2">
            {(snapshots.data ?? []).map((s) => {
              const expanded = expandedSnapshotId === s.id;
              const snapshotItems = s.items;
              return (
                <div key={s.id} className="rounded-md border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <button
                      type="button"
                      className="text-left text-brand-700 hover:underline"
                      onClick={() => setExpandedSnapshotId(expanded ? null : s.id)}
                    >
                      {formatDateIt(s.createdAt)} — {formatCurrency(s.grandTotal, true)} (IVA {s.vatRatePct}%, {snapshotItems.length} voci)
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      disabled={deleteSnapshot.isPending}
                      onClick={() => deleteSnapshot.mutate({ id: s.id })}
                    >
                      Elimina
                    </button>
                  </div>
                  {expanded && (
                    <table className="w-full border-t border-slate-200 text-xs">
                      <tbody>
                        {snapshotItems.map((item, i) => (
                          <tr key={i} className="border-b border-slate-100 last:border-0">
                            <td className="px-3 py-1">{item.description}</td>
                            <td className="px-3 py-1 text-right text-slate-500">
                              {item.quantity ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : ""}
                            </td>
                            <td className="px-3 py-1 text-right">{formatCurrency(item.price, true)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
