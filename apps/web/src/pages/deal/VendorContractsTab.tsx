import { useEffect, useState } from "react";
import { formatCurrency } from "../../lib/format";
import type { DealDetail, CostLineItemDetail } from "../../lib/types";
import { Button } from "../../components/ui/Button";
import logoUrl from "../../assets/housetohome-logo.jpg";
import { formatDateIt } from "./PreventivoTab";

type VendorInfo = NonNullable<CostLineItemDetail["vendor"]>;

function rowTotal(item: CostLineItemDetail): number {
  return item.taxableAmount + (item.taxableAmount * item.vatRatePct) / 100 + item.nonTaxableAmount;
}

/**
 * Un "contratto lavori" per fornitore, stesso formato (intestazione, logo,
 * colori) del preventivo cliente, ma con solo le voci di costo assegnate a
 * quel fornitore in questo deal e i prezzi che paghiamo noi (non quelli del
 * cliente). Serve a far firmare al fornitore l'accordo preparato da noi,
 * invece di aspettare un suo preventivo.
 *
 * Solo voci di gruppo Lavorazioni (manodopera, es. Sergio/Mattia/Gianni): i
 * fornitori di solo materiale (es. Cambielli) hanno già un loro preventivo
 * firmato e restano fuori da questa tab.
 */
export default function VendorContractsTab({ deal }: { deal: DealDetail }) {
  const [printingVendorId, setPrintingVendorId] = useState<string | null>(null);

  useEffect(() => {
    const reset = () => setPrintingVendorId(null);
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);

  const items = deal.costLineItems.filter((i) => !i.isMemo && i.vendor && i.category.group === "LAVORAZIONI");
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
        Un contratto lavori per ogni fornitore di manodopera (Lavorazioni), con solo le voci di costo a lui
        assegnate in questo deal e i prezzi che paghi tu, non quelli del cliente. I fornitori di solo materiale non
        compaiono qui, perché hanno già un loro preventivo firmato.
      </p>

      {vendorGroups.length === 0 && (
        <p className="text-sm text-slate-400 print:hidden">
          Nessuna voce di Lavorazioni con un fornitore assegnato nella scheda Ristrutturazione.
        </p>
      )}

      {vendorGroups.map(({ vendor, items: vendorItems }) => {
        const total = vendorItems.reduce((sum, item) => sum + rowTotal(item), 0);
        const hidden = printingVendorId !== null && printingVendorId !== vendor.id;
        return (
          <div key={vendor.id} className={hidden ? "print:hidden" : undefined}>
            <div className="flex justify-end print:hidden">
              <Button
                variant="secondary"
                onClick={() => {
                  setPrintingVendorId(vendor.id);
                  requestAnimationFrame(() => window.print());
                }}
              >
                Stampa contratto {vendor.name}
              </Button>
            </div>

            <div className="mt-2 bg-white p-6 text-[11px] leading-snug text-slate-800 shadow-sm print:p-10 print:shadow-none">
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
                  <div className="mt-1">{vendor.name}</div>
                  <div>Contratto per i lavori in {deal.address || deal.name}</div>
                  <div className="mt-4">Data: {formatDateIt(new Date())}</div>
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
                  {vendorItems.map((item) => {
                    const total = rowTotal(item);
                    const qty = item.quantity ?? null;
                    const unitPrice = qty ? total / qty : null;
                    const isMq = item.unit === "mq";
                    return (
                      <tr key={item.id}>
                        <td className="border border-slate-300 px-2 py-1">{item.description}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right">{qty && isMq ? qty : ""}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right">
                          {unitPrice !== null ? formatCurrency(unitPrice, true) : ""}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right">
                          {qty && !isMq ? `${qty}${item.unit ? ` ${item.unit}` : ""}` : ""}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right">{formatCurrency(total, true)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <table className="w-full border-collapse">
                <tbody>
                  <tr className="bg-cyan-400 font-bold italic text-white">
                    <td className="border border-slate-300 px-2 py-1">TOTALE</td>
                    <td className="border border-slate-300 px-2 py-1" colSpan={4}>
                      {formatCurrency(total, true)}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 px-2 py-6" colSpan={5}>
                      <div className="text-center font-medium">DATA E FIRMA PER ACCETTAZIONE</div>
                      <div className="mx-auto mt-10 w-80 border-t border-slate-400" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
