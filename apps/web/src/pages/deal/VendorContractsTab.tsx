import { useEffect, useRef, useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatCurrency } from "../../lib/format";
import type { DealDetail, CostLineItemDetail } from "../../lib/types";
import { Button } from "../../components/ui/Button";
import { downloadElementAsPdf, generatePdfBase64 } from "../../lib/pdf";
import logoUrl from "../../assets/housetohome-logo.jpg";
import { formatDateIt } from "./PreventivoTab";

type VendorInfo = NonNullable<CostLineItemDetail["vendor"]>;

function rowTotal(item: CostLineItemDetail): number {
  return item.taxableAmount + (item.taxableAmount * item.vatRatePct) / 100 + item.nonTaxableAmount;
}

/**
 * Un "contratto lavori" per fornitore, stesso formato (intestazione, logo,
 * colori) del preventivo cliente, ma con solo le voci di costo assegnate a
 * quel fornitore in questo deal (Materiali e Lavorazioni insieme) e i prezzi
 * che paghiamo noi (non quelli del cliente). Serve a far firmare al
 * fornitore l'accordo preparato da noi, invece di aspettare un suo
 * preventivo — per fornitori come Sergio che forniscono sia materiale
 * (es. infissi, porte) sia manodopera, il contratto deve contenere tutto.
 */
export default function VendorContractsTab({ deal }: { deal: DealDetail }) {
  const [printingVendorId, setPrintingVendorId] = useState<string | null>(null);
  const [downloadingVendorId, setDownloadingVendorId] = useState<string | null>(null);
  const [sendingVendorId, setSendingVendorId] = useState<string | null>(null);
  const [emailResults, setEmailResults] = useState<Record<string, "success" | string>>({});
  const printRefs = useRef(new Map<string, HTMLDivElement>());
  const sendVendorContractEmail = trpc.email.sendVendorContract.useMutation();

  useEffect(() => {
    const reset = () => setPrintingVendorId(null);
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);

  const items = deal.costLineItems.filter((i) => !i.isMemo && i.vendor);
  const byVendor = new Map<string, { vendor: VendorInfo; items: CostLineItemDetail[] }>();
  for (const item of items) {
    const vendor = item.vendor;
    if (!vendor) continue;
    const g = byVendor.get(vendor.id) ?? { vendor, items: [] };
    g.items.push(item);
    byVendor.set(vendor.id, g);
  }
  const vendorGroups = [...byVendor.values()].sort((a, b) => a.vendor.name.localeCompare(b.vendor.name));

  return (
    <div className="grid gap-5">
      <p className="text-sm text-slate-500 print:hidden">
        Un contratto lavori per ogni fornitore, con tutte le voci di costo a lui assegnate in questo deal (materiale
        e lavorazioni insieme) e i prezzi che paghi tu, non quelli del cliente.
      </p>

      {vendorGroups.length === 0 && (
        <p className="text-sm text-slate-400 print:hidden">
          Nessuna voce di costo con un fornitore assegnato nella scheda Ristrutturazione.
        </p>
      )}

      {vendorGroups.map(({ vendor, items: vendorItems }) => {
        const total = vendorItems.reduce((sum, item) => sum + rowTotal(item), 0);
        // Imponibile e IVA separati: nel contratto fornitore deve comparire
        // sia il prezzo senza IVA sia quello con IVA (es. Cambielli al 22%),
        // perché è l'IVA che paghiamo noi al fornitore, non quella che
        // incassiamo dal cliente nel preventivo.
        const imponibile = vendorItems.reduce((sum, item) => sum + item.taxableAmount + item.nonTaxableAmount, 0);
        const vatAmount = vendorItems.reduce((sum, item) => sum + (item.taxableAmount * item.vatRatePct) / 100, 0);
        const vatRates = [...new Set(vendorItems.map((item) => item.vatRatePct))];
        const uniformVatPct = vatRates.length === 1 ? vatRates[0] : null;
        const hidden = printingVendorId !== null && printingVendorId !== vendor.id;
        return (
          <div key={vendor.id} className={hidden ? "print:hidden" : undefined}>
            <div className="flex justify-end gap-2 print:hidden">
              <Button
                variant="secondary"
                onClick={() => {
                  setPrintingVendorId(vendor.id);
                  requestAnimationFrame(() => window.print());
                }}
              >
                Stampa contratto {vendor.name}
              </Button>
              <Button
                variant="secondary"
                disabled={downloadingVendorId === vendor.id}
                onClick={async () => {
                  const el = printRefs.current.get(vendor.id);
                  if (!el) return;
                  setDownloadingVendorId(vendor.id);
                  try {
                    await downloadElementAsPdf(el, `Contratto ${vendor.name} - ${deal.name}.pdf`);
                  } finally {
                    setDownloadingVendorId(null);
                  }
                }}
              >
                {downloadingVendorId === vendor.id ? "Generazione PDF..." : "Scarica PDF"}
              </Button>
              <Button
                variant="secondary"
                disabled={sendingVendorId === vendor.id || !vendor.email}
                title={!vendor.email ? "Questo fornitore non ha un'email salvata (pagina Fornitori)" : undefined}
                onClick={async () => {
                  const el = printRefs.current.get(vendor.id);
                  if (!el) return;
                  setSendingVendorId(vendor.id);
                  setEmailResults((prev) => ({ ...prev, [vendor.id]: "" }));
                  try {
                    const pdfBase64 = await generatePdfBase64(el);
                    await sendVendorContractEmail.mutateAsync({ dealId: deal.id, vendorId: vendor.id, pdfBase64 });
                    setEmailResults((prev) => ({ ...prev, [vendor.id]: "success" }));
                  } catch (err) {
                    setEmailResults((prev) => ({
                      ...prev,
                      [vendor.id]: err instanceof Error ? err.message : "errore sconosciuto",
                    }));
                  } finally {
                    setSendingVendorId(null);
                  }
                }}
              >
                {sendingVendorId === vendor.id ? "Invio in corso..." : `Invia email a ${vendor.name}`}
              </Button>
            </div>
            {emailResults[vendor.id] === "success" && (
              <p className="text-right text-sm text-emerald-600 print:hidden">Email inviata a {vendor.email}.</p>
            )}
            {emailResults[vendor.id] && emailResults[vendor.id] !== "success" && (
              <p className="text-right text-sm text-red-600 print:hidden">Errore invio email: {emailResults[vendor.id]}</p>
            )}

            <div
              ref={(el) => {
                if (el) printRefs.current.set(vendor.id, el);
                else printRefs.current.delete(vendor.id);
              }}
              className="mt-2 bg-white p-6 text-[11px] leading-snug text-slate-800 shadow-sm print:p-[20mm] print:shadow-none"
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
                  <div className="inline-block whitespace-nowrap bg-cyan-400 px-3 py-1 font-semibold leading-normal text-white">
                    Spett.le
                  </div>
                  <div className="mt-1">{vendor.name}</div>
                  <div>Contratto per i lavori in {deal.address || deal.name}</div>
                  <div className="mt-4">Data: {formatDateIt(new Date())}</div>
                </div>
              </div>

              {/* Griglia di div al posto di <table>/<tr>: vedi nota in
                  PreventivoTab.tsx sul bug di html2pdf.js con le righe che
                  non ci stanno su una pagina. Ogni riga ha un bordo completo
                  (non solo un bordo condiviso per l'intera tabella). */}
              <div className="mt-5">
                <div className="grid grid-cols-[1fr_5rem_6rem] border border-slate-300 bg-cyan-400 text-left text-white">
                  <div className="border-r border-slate-300 px-2 py-1">DESCRIZIONE LAVORI</div>
                  <div className="border-r border-slate-300 px-2 py-1 text-right">QTÀ</div>
                  <div className="px-2 py-1 text-right">
                    TOTALE
                    <br />€
                  </div>
                </div>
                {vendorItems.map((item) => {
                  const qty = item.quantity ?? null;
                  return (
                    <div key={item.id} className="-mt-px grid grid-cols-[1fr_5rem_6rem] break-inside-avoid border border-slate-300">
                      <div className="border-r border-slate-300 px-2 py-1">{item.description}</div>
                      <div className="border-r border-slate-300 px-2 py-1 text-right">
                        {qty ? `${qty}${item.unit ? ` ${item.unit}` : ""}` : ""}
                      </div>
                      <div className="px-2 py-1 text-right">{formatCurrency(rowTotal(item), true)}</div>
                    </div>
                  );
                })}
              </div>

              <div className="break-inside-avoid">
              <table className="w-full border-collapse">
                <tbody>
                  <tr className="font-semibold">
                    <td className="border border-slate-300 px-2 py-1">TOTALE SENZA IVA</td>
                    <td className="border border-slate-300 px-2 py-1" colSpan={2}>
                      {formatCurrency(imponibile, true)}
                    </td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="border border-slate-300 px-2 py-1">
                      IVA{uniformVatPct !== null ? ` (${uniformVatPct}%)` : ""}
                    </td>
                    <td className="border border-slate-300 px-2 py-1" colSpan={2}>
                      {formatCurrency(vatAmount, true)}
                    </td>
                  </tr>
                  <tr className="bg-cyan-400 font-bold italic text-white">
                    <td className="border border-slate-300 px-2 py-1">TOTALE CON IVA</td>
                    <td className="border border-slate-300 px-2 py-1" colSpan={2}>
                      {formatCurrency(total, true)}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 px-2 py-6" colSpan={3}>
                      <div className="text-center font-medium">DATA E FIRMA PER ACCETTAZIONE</div>
                      <div className="mx-auto mt-10 w-80 border-t border-slate-400" />
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
