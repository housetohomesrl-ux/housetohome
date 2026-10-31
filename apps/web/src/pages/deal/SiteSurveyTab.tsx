import { useRef, useState } from "react";
import { trpc } from "../../lib/trpc";
import type { DealDetail, PriceListItem, CostCategory, Vendor } from "../../lib/types";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { downloadElementAsPdf, generatePdfBase64 } from "../../lib/pdf";
import { formatDateIt } from "./PreventivoTab";
import logoUrl from "../../assets/housetohome-logo.jpg";

const VENDOR_PRIORITY = ["Sergio", "Mattia Scarpuzza", "Gianni Montanari"];

function vendorRank(name: string | undefined): number {
  const idx = VENDOR_PRIORITY.indexOf(name ?? "");
  return idx >= 0 ? idx : VENDOR_PRIORITY.length;
}

/**
 * Lista sopralluogo: tutte le voci della libreria prezzi (stesso
 * libraryScope del deal), da flaggare sul posto durante il sopralluogo
 * invece di scrivere ogni lavorazione a mano — il titolo flaggato è già
 * quello di libreria, nessuna descrizione da inventare lì per lì. Una volta
 * flaggate, genera una lista per fornitore (solo le voci flaggate di quel
 * fornitore, senza prezzi) da stampare/scaricare/mandare per email: il
 * fornitore ci scrive sopra i prezzi (o fa un suo preventivo a parte), che
 * poi va trascritto nella scheda Ristrutturazione per costruire il
 * preventivo cliente vero e proprio.
 *
 * Le caselle flaggate sono salvate (per deal), per poter riprendere un
 * sopralluogo lasciato a metà senza perdere la selezione.
 */
export default function SiteSurveyTab({ deal }: { deal: DealDetail }) {
  const utils = trpc.useUtils();
  const priceList = trpc.priceListItem.list.useQuery();
  const checklist = trpc.surveyChecklist.list.useQuery({ dealId: deal.id });
  const toggleChecklist = trpc.surveyChecklist.toggle.useMutation({
    onSuccess: () => utils.surveyChecklist.list.invalidate({ dealId: deal.id }),
  });
  const [search, setSearch] = useState("");
  const [printingVendorId, setPrintingVendorId] = useState<string | null>(null);
  const [downloadingVendorId, setDownloadingVendorId] = useState<string | null>(null);
  const [sendingVendorId, setSendingVendorId] = useState<string | null>(null);
  const [emailResults, setEmailResults] = useState<Record<string, "success" | string>>({});
  const printRefs = useRef(new Map<string, HTMLDivElement>());
  const sendQuoteRequest = trpc.email.sendVendorQuoteRequest.useMutation();

  const available = (priceList.data ?? []).filter(
    (p) => p.libraryScope === deal.operationType && p.category.group !== "ACQUISIZIONE" && p.category.group !== "ENTI_ESTERNI",
  );
  const filtered = search.trim()
    ? available.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : available;

  type Item = PriceListItem & { category: CostCategory; vendor: Vendor | null };
  const byVendor = new Map<string, { vendor: Vendor | null; items: Item[] }>();
  for (const item of filtered as Item[]) {
    const key = item.vendor?.id ?? "__none__";
    const g = byVendor.get(key) ?? { vendor: item.vendor, items: [] };
    g.items.push(item);
    byVendor.set(key, g);
  }
  const vendorGroups = [...byVendor.values()].sort(
    (a, b) => vendorRank(a.vendor?.name) - vendorRank(b.vendor?.name) || (a.vendor?.name ?? "zzz").localeCompare(b.vendor?.name ?? "zzz"),
  );

  const checkedIds = new Set(checklist.data ?? []);

  function toggle(id: string) {
    toggleChecklist.mutate({ dealId: deal.id, priceListItemId: id, checked: !checkedIds.has(id) });
  }

  const checkedCount = checkedIds.size;
  const vendorsToSend = vendorGroups
    .filter((g) => g.vendor)
    .map((g) => ({ vendor: g.vendor!, items: g.items.filter((i) => checkedIds.has(i.id)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="grid gap-5">
      <p className="text-sm text-slate-500 print:hidden">
        Flagga le lavorazioni emerse dal sopralluogo (stesso titolo della libreria prezzi, niente da scrivere sul posto). Poi genera e
        manda ai fornitori la lista delle sole voci flaggate, senza prezzi, perché la preventivino.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Input placeholder="Cerca per nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
        <span className="text-sm text-slate-500">{checkedCount} voci flaggate</span>
      </div>

      <div className="grid gap-6 print:hidden">
        {vendorGroups.map(({ vendor, items }) => (
          <div key={vendor?.id ?? "__none__"}>
            <h2 className="rounded-t-md bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
              {vendor?.name ?? "Senza fornitore"}
            </h2>
            <div className="grid gap-1 rounded-b-md border border-t-0 border-slate-200 p-2">
              {items.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 rounded-md p-2 active:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-brand-600"
                    checked={checkedIds.has(item.id)}
                    onChange={() => toggle(item.id)}
                  />
                  <span className="text-sm text-slate-800">{item.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        {vendorGroups.length === 0 && (
          <p className="text-sm text-slate-400">Nessuna voce in libreria per questo tipo di deal.</p>
        )}
      </div>

      {vendorsToSend.length > 0 && (
        <div className="grid gap-5">
          <h2 className="text-sm font-semibold text-slate-700 print:hidden">Liste per fornitore (da inviare)</h2>
          {vendorsToSend.map(({ vendor, items }) => {
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
                    Stampa lista {vendor.name}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={downloadingVendorId === vendor.id}
                    onClick={async () => {
                      const el = printRefs.current.get(vendor.id);
                      if (!el) return;
                      setDownloadingVendorId(vendor.id);
                      try {
                        await downloadElementAsPdf(el, `Richiesta preventivo ${vendor.name} - ${deal.name}.pdf`);
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
                        await sendQuoteRequest.mutateAsync({ dealId: deal.id, vendorId: vendor.id, pdfBase64 });
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
                      <div>Richiesta preventivo per {deal.address || deal.name}</div>
                      <div className="mt-4">Data: {formatDateIt(new Date())}</div>
                    </div>
                  </div>

                  <p className="mt-4">
                    In seguito al sopralluogo, vi chiediamo cortesemente un preventivo per le seguenti lavorazioni.
                  </p>

                  <div className="mt-3 border-l border-t border-slate-300">
                    <div className="grid grid-cols-[1fr_8rem] bg-cyan-400 text-left text-white">
                      <div className="border-b border-r border-slate-300 px-2 py-1">DESCRIZIONE LAVORI</div>
                      <div className="border-b border-r border-slate-300 px-2 py-1 text-right">RIFERIMENTO</div>
                    </div>
                    {items.map((item) => (
                      <div key={item.id} className="grid grid-cols-[1fr_8rem] break-inside-avoid">
                        <div className="border-b border-r border-slate-300 px-2 py-1">{item.name}</div>
                        <div className="border-b border-r border-slate-300 px-2 py-1 text-right text-slate-500">
                          {item.referenceQuantity ?? ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
