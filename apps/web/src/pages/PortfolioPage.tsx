import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { formatCurrency, formatPercent } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Select } from "../components/ui/Field";

const STATUS_LABEL: Record<string, string> = {
  VALUTAZIONE: "In valutazione",
  ACQUISIZIONE: "In acquisizione",
  RISTRUTTURAZIONE: "In ristrutturazione",
  VENDITA: "In vendita",
  CHIUSO: "Chiuso",
  ARCHIVIATO: "Archiviato",
};

const STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success"> = {
  VALUTAZIONE: "neutral",
  ACQUISIZIONE: "info",
  RISTRUTTURAZIONE: "warning",
  VENDITA: "info",
  CHIUSO: "success",
  ARCHIVIATO: "neutral",
};

type SortKey = "updated" | "roi" | "netProfit";

export default function PortfolioPage() {
  const navigate = useNavigate();
  const deals = trpc.deal.list.useQuery();
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("updated");

  const createDeal = trpc.deal.create.useMutation({
    onSuccess: async (deal) => {
      await utils.deal.list.invalidate();
      navigate(`/deals/${deal.id}`);
    },
  });

  const filtered = useMemo(() => {
    const rows = deals.data ?? [];
    const byStatus = statusFilter === "ALL" ? rows : rows.filter((d) => d.status === statusFilter);
    return [...byStatus].sort((a, b) => {
      if (sortKey === "roi") return (b.summary?.roi ?? -Infinity) - (a.summary?.roi ?? -Infinity);
      if (sortKey === "netProfit") return (b.summary?.netProfit ?? -Infinity) - (a.summary?.netProfit ?? -Infinity);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [deals.data, statusFilter, sortKey]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Portafoglio deal</h1>
          <p className="mt-1 text-sm text-slate-500">Tutte le operazioni di buy-renovate-resell del tuo team.</p>
        </div>
        <Button onClick={() => createDeal.mutate({ name: "Nuovo deal" })} disabled={createDeal.isPending}>
          + Nuovo deal
        </Button>
      </div>

      <div className="mt-4 flex gap-3">
        <Select className="max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">Tutti gli stati</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select className="max-w-xs" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="updated">Ordina per: ultimo aggiornamento</option>
          <option value="roi">Ordina per: ROI (scenario realistico)</option>
          <option value="netProfit">Ordina per: utile netto (scenario realistico)</option>
        </Select>
      </div>

      <div className="mt-4 grid gap-3">
        {filtered.map((deal) => (
          <Card key={deal.id} className="cursor-pointer hover:border-brand-300" >
            <button className="w-full text-left" onClick={() => navigate(`/deals/${deal.id}`)}>
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-900">{deal.name}</h3>
                    <Badge tone={STATUS_TONE[deal.status]}>{STATUS_LABEL[deal.status]}</Badge>
                    {deal.isDemo && <Badge tone="neutral">Demo</Badge>}
                  </div>
                  {deal.address && <p className="mt-1 text-sm text-slate-500">{deal.address}</p>}
                </div>
                {deal.summary ? (
                  <div className="flex gap-6 text-right">
                    <div>
                      <div className="text-xs text-slate-400">Utile netto (realistico)</div>
                      <div className="font-semibold text-slate-900">{formatCurrency(deal.summary.netProfit)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">ROI</div>
                      <div className={deal.summary.roi >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
                        {formatPercent(deal.summary.roi)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Badge tone="warning">Dati incompleti</Badge>
                )}
              </div>
            </button>
          </Card>
        ))}
        {filtered.length === 0 && !deals.isLoading && (
          <p className="py-12 text-center text-sm text-slate-400">Nessun deal. Creane uno per iniziare.</p>
        )}
      </div>
    </div>
  );
}
