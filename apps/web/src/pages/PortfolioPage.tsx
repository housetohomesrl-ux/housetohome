import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { formatCurrency, formatPercent } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Field";
import type { DealSummary } from "../lib/types";

const STATUS_LABEL: Record<string, string> = {
  VALUTAZIONE: "In valutazione",
  ACQUISIZIONE: "Acquistato",
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

  const createDeal = trpc.deal.create.useMutation({
    onSuccess: async (deal) => {
      await utils.deal.list.invalidate();
      navigate(`/deals/${deal.id}`);
    },
  });
  const deleteDeal = trpc.deal.delete.useMutation({
    onSuccess: () => utils.deal.list.invalidate(),
  });
  const markPurchased = trpc.deal.update.useMutation({
    onSuccess: () => utils.deal.list.invalidate(),
  });

  function confirmDelete(deal: { id: string; name: string }) {
    const ok = window.confirm(
      `Eliminare il deal "${deal.name}"?\n\nVerranno cancellati anche preventivo, finanziamenti, scenari di vendita e note collegati. L'operazione non è reversibile.`,
    );
    if (ok) deleteDeal.mutate({ id: deal.id });
  }

  const flipDeals = useMemo(() => (deals.data ?? []).filter((d) => d.operationType === "FLIP"), [deals.data]);
  const clientDeals = useMemo(
    () => (deals.data ?? []).filter((d) => d.operationType === "RISTRUTTURAZIONE_CLIENTE"),
    [deals.data],
  );

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Portafoglio deal</h1>
        <p className="mt-1 text-sm text-slate-500">Tutte le operazioni di buy-renovate-resell del tuo team.</p>
      </div>

      <DealSection
        title="Flip — acquisto e rivendita"
        deals={flipDeals}
        loading={deals.isLoading}
        emptyLabel="Nessun deal flip. Creane uno per iniziare."
        newDealLabel="+ Nuovo flip"
        operationType="FLIP"
        onOpen={(id) => navigate(`/deals/${id}`)}
        onDelete={confirmDelete}
        deleteDeal={deleteDeal}
        createDeal={createDeal}
        markPurchased={markPurchased}
      />

      <DealSection
        title="Ristrutturazioni per clienti — solo preventivo"
        deals={clientDeals}
        loading={deals.isLoading}
        emptyLabel="Nessuna ristrutturazione per cliente. Creane una per iniziare."
        newDealLabel="+ Nuova ristrutturazione"
        operationType="RISTRUTTURAZIONE_CLIENTE"
        onOpen={(id) => navigate(`/deals/${id}`)}
        onDelete={confirmDelete}
        deleteDeal={deleteDeal}
        createDeal={createDeal}
        className="mt-8"
      />
    </div>
  );
}

function DealSection({
  title,
  deals,
  loading,
  emptyLabel,
  newDealLabel,
  operationType,
  onOpen,
  onDelete,
  deleteDeal,
  createDeal,
  markPurchased,
  className = "mt-6",
}: {
  title: string;
  deals: DealSummary[];
  loading: boolean;
  emptyLabel: string;
  newDealLabel: string;
  operationType: "FLIP" | "RISTRUTTURAZIONE_CLIENTE";
  onOpen: (id: string) => void;
  onDelete: (deal: { id: string; name: string }) => void;
  deleteDeal: ReturnType<typeof trpc.deal.delete.useMutation>;
  createDeal: ReturnType<typeof trpc.deal.create.useMutation>;
  markPurchased?: ReturnType<typeof trpc.deal.update.useMutation>;
  className?: string;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [addressFilter, setAddressFilter] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [showNewDealForm, setShowNewDealForm] = useState(false);
  const [newDealAddress, setNewDealAddress] = useState("");

  const addresses = useMemo(() => {
    const set = new Set(deals.map((d) => d.address).filter((a): a is string => !!a));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [deals]);

  const filtered = useMemo(() => {
    const byStatus = statusFilter === "ALL" ? deals : deals.filter((d) => d.status === statusFilter);
    const byAddress = addressFilter === "ALL" ? byStatus : byStatus.filter((d) => d.address === addressFilter);
    return [...byAddress].sort((a, b) => {
      if (sortKey === "roi") return (b.summary?.roi ?? -Infinity) - (a.summary?.roi ?? -Infinity);
      if (sortKey === "netProfit") return (b.summary?.netProfit ?? -Infinity) - (a.summary?.netProfit ?? -Infinity);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [deals, statusFilter, addressFilter, sortKey]);

  function submitNewDeal() {
    const address = newDealAddress.trim();
    createDeal.mutate({ name: address || "Nuovo deal", address: address || undefined, operationType });
    setShowNewDealForm(false);
    setNewDealAddress("");
  }

  return (
    <div className={className}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title} ({deals.length})
      </h2>

      <div className="mt-2 flex gap-3">
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
        <Select className="max-w-xs" value={addressFilter} onChange={(e) => setAddressFilter(e.target.value)}>
          <option value="ALL">Tutti gli indirizzi</option>
          {addresses.map((address) => (
            <option key={address} value={address}>
              {address}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-3 grid gap-3">
        {filtered.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            onOpen={() => onOpen(deal.id)}
            onDelete={() => onDelete(deal)}
            deleting={deleteDeal.isPending && deleteDeal.variables?.id === deal.id}
            onMarkPurchased={markPurchased ? () => markPurchased.mutate({ id: deal.id, status: "ACQUISIZIONE" }) : undefined}
            markingPurchased={markPurchased ? markPurchased.isPending && markPurchased.variables?.id === deal.id : false}
          />
        ))}
        {filtered.length === 0 && !loading && <p className="py-6 text-center text-sm text-slate-400">{emptyLabel}</p>}
      </div>

      <div className="mt-3">
        {showNewDealForm ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              placeholder="Indirizzo dell'immobile"
              className="w-64"
              value={newDealAddress}
              onChange={(e) => setNewDealAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitNewDeal()}
            />
            <Button onClick={submitNewDeal} disabled={createDeal.isPending}>
              Crea
            </Button>
            <button
              className="text-sm text-slate-500 hover:underline"
              onClick={() => {
                setShowNewDealForm(false);
                setNewDealAddress("");
              }}
            >
              Annulla
            </button>
          </div>
        ) : (
          <Button onClick={() => setShowNewDealForm(true)}>{newDealLabel}</Button>
        )}
      </div>
    </div>
  );
}

function DealCard({
  deal,
  onOpen,
  onDelete,
  deleting,
  onMarkPurchased,
  markingPurchased,
}: {
  deal: DealSummary;
  onOpen: () => void;
  onDelete: () => void;
  deleting: boolean;
  onMarkPurchased?: () => void;
  markingPurchased?: boolean;
}) {
  return (
    <Card className="flex items-center hover:border-brand-300">
      <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
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
      <div className="mr-3 flex shrink-0 items-center gap-2">
        {deal.status === "VALUTAZIONE" && onMarkPurchased && (
          <Button variant="secondary" onClick={onMarkPurchased} disabled={markingPurchased}>
            Ho acquistato
          </Button>
        )}
        <Button variant="ghost" className="text-red-600 hover:bg-red-50" title="Elimina deal" onClick={onDelete} disabled={deleting}>
          Elimina
        </Button>
      </div>
    </Card>
  );
}
