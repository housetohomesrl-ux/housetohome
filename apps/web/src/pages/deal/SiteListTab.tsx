import { useRef, useState } from "react";
import { trpc } from "../../lib/trpc";
import type { DealDetail, CostLineItemDetail } from "../../lib/types";
import { Button } from "../../components/ui/Button";
import { downloadElementAsPdf } from "../../lib/pdf";
import { formatDateIt } from "./PreventivoTab";

type VendorInfo = NonNullable<CostLineItemDetail["vendor"]>;

const STATUS_CYCLE = ["DA_FARE", "IN_CORSO", "COMPLETATO"] as const;

function StatusBox({ status, onClick }: { status: string; onClick: () => void }) {
  const isDone = status === "COMPLETATO";
  const isInProgress = status === "IN_CORSO";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-5 w-5 shrink-0 items-center justify-center border text-xs font-bold print:border-black ${
        isDone
          ? "border-emerald-600 bg-emerald-600 text-white"
          : isInProgress
            ? "border-amber-500 bg-amber-100 text-amber-700"
            : "border-slate-400 bg-white"
      }`}
      title="Click per cambiare stato (da fare → in corso → completato)"
    >
      {isDone ? "✓" : isInProgress ? "~" : ""}
    </button>
  );
}

/**
 * Lista lavorazioni da stampare e attaccare in cantiere: solo descrizione,
 * quantità/unità e stato di avanzamento, raggruppata per fornitore — niente
 * prezzi né dati del cliente. La casella di stato è cliccabile (da fare →
 * in corso → completato) e aggiorna lo stesso campo status già usato nella
 * scheda Ristrutturazione, quindi funziona anche come lista di controllo
 * live, non solo come foglio da stampare una volta.
 */
export default function SiteListTab({ deal }: { deal: DealDetail }) {
  const utils = trpc.useUtils();
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const updateStatus = trpc.costLineItem.update.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });

  function cycleStatus(item: CostLineItemDetail) {
    const currentIndex = STATUS_CYCLE.indexOf(item.status as (typeof STATUS_CYCLE)[number]);
    const next = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
    updateStatus.mutate({ id: item.id, status: next });
  }

  const items = deal.costLineItems.filter((i) => !i.isMemo && i.category.group === "LAVORAZIONI");
  const byVendor = new Map<string, { vendor: VendorInfo | null; items: CostLineItemDetail[] }>();
  for (const item of items) {
    const key = item.vendor?.id ?? "__none__";
    const g = byVendor.get(key) ?? { vendor: item.vendor, items: [] };
    g.items.push(item);
    byVendor.set(key, g);
  }
  const vendorGroups = [...byVendor.values()].sort((a, b) => (a.vendor?.name ?? "zzz").localeCompare(b.vendor?.name ?? "zzz"));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <p className="text-sm text-slate-500">
          Solo le voci di Lavorazioni, raggruppate per fornitore, senza prezzi: da stampare e attaccare in cantiere. Clicca la casella per
          segnare lo stato (da fare → in corso → completato).
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            Stampa lista
          </Button>
          <Button
            variant="secondary"
            disabled={downloading}
            onClick={async () => {
              if (!printRef.current) return;
              setDownloading(true);
              try {
                await downloadElementAsPdf(printRef.current, `Lista lavori ${deal.name}.pdf`);
              } finally {
                setDownloading(false);
              }
            }}
          >
            {downloading ? "Generazione PDF..." : "Scarica PDF"}
          </Button>
        </div>
      </div>

      <div ref={printRef} className="bg-white p-6 text-sm text-slate-800 shadow-sm print:p-10 print:shadow-none">
        <div className="flex items-baseline justify-between border-b border-slate-300 pb-2">
          <h1 className="text-lg font-bold uppercase tracking-wide">Lista lavori — {deal.address || deal.name}</h1>
          <span className="text-xs text-slate-500">Aggiornato al {formatDateIt(new Date())}</span>
        </div>

        {vendorGroups.length === 0 && (
          <p className="mt-4 text-sm text-slate-400">Nessuna voce di Lavorazioni nella scheda Ristrutturazione.</p>
        )}

        <div className="mt-4 grid gap-6">
          {vendorGroups.map(({ vendor, items: vendorItems }) => (
            <div key={vendor?.id ?? "__none__"} className="break-inside-avoid">
              <h2 className="bg-slate-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                {vendor?.name ?? "Senza fornitore assegnato"}
              </h2>
              <ul className="mt-2 grid gap-2">
                {vendorItems.map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <StatusBox status={item.status} onClick={() => cycleStatus(item)} />
                    <span className={item.status === "COMPLETATO" ? "text-slate-400 line-through" : ""}>
                      {item.description}
                      {item.quantity ? ` — ${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
