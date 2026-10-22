import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { formatCurrency, formatPercent } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Field";
import type { DealSummary } from "../lib/types";
import { FLIP_STATUS_LABEL, CLIENT_STATUS_LABEL } from "../lib/dealStatus";
import { formatDateIt } from "./deal/PreventivoTab";

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

  // Preventivi inviati al cliente e in scadenza entro 7 giorni o già
  // scaduti: per non doverli controllare uno a uno aprendo ogni deal.
  const pendingQuotes = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return clientDeals
      .filter((d) => d.quoteStatus === "INVIATO" && d.quoteValidUntil)
      .map((d) => {
        const validUntil = new Date(d.quoteValidUntil!);
        const daysToExpiry = Math.ceil((validUntil.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { ...d, validUntil, daysToExpiry };
      })
      .filter((d) => d.daysToExpiry <= 7)
      .sort((a, b) => a.daysToExpiry - b.daysToExpiry);
  }, [clientDeals]);

  // Ristrutturazioni concluse con un saldo cliente ancora aperto: il lavoro
  // è finito ma il cliente non ha ancora pagato tutto.
  const openBalances = useMemo(
    () =>
      clientDeals
        .filter((d) => d.status === "CHIUSO" && (d.dueFromClient ?? 0) > 0.5)
        .sort((a, b) => (b.dueFromClient ?? 0) - (a.dueFromClient ?? 0)),
    [clientDeals],
  );

  // Rate (acconti/saldo) con una scadenza impostata passata e ancora a 0:
  // un acconto/saldo che non è arrivato entro la data prevista.
  const overduePayments = useMemo(
    () => clientDeals.flatMap((d) => (d.overdueInstallments ?? []).map((inst) => ({ deal: d, ...inst }))),
    [clientDeals],
  );

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Portafoglio deal</h1>
        <p className="mt-1 text-sm text-slate-500">Tutte le operazioni di buy-renovate-resell del tuo team.</p>
      </div>

      {pendingQuotes.length > 0 && (
        <Card className="mt-4 border-amber-300 bg-amber-50">
          <div className="px-4 py-3">
            <h2 className="text-sm font-semibold text-amber-800">Preventivi in sospeso</h2>
            <div className="mt-2 grid gap-1">
              {pendingQuotes.map((d) => (
                <button
                  key={d.id}
                  className="flex items-center justify-between text-left text-sm hover:underline"
                  onClick={() => navigate(`/deals/${d.id}`)}
                >
                  <span className="text-slate-800">
                    {d.name}
                    {d.address ? ` — ${d.address}` : ""}
                  </span>
                  <span className={d.daysToExpiry < 0 ? "font-medium text-red-700" : "font-medium text-amber-700"}>
                    {d.daysToExpiry < 0
                      ? `scaduto il ${formatDateIt(d.validUntil)}`
                      : d.daysToExpiry === 0
                        ? "scade oggi"
                        : `scade tra ${d.daysToExpiry} giorn${d.daysToExpiry === 1 ? "o" : "i"}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {openBalances.length > 0 && (
        <Card className="mt-4 border-red-300 bg-red-50">
          <div className="px-4 py-3">
            <h2 className="text-sm font-semibold text-red-800">Saldi da incassare</h2>
            <p className="text-xs text-red-700">Ristrutturazioni concluse con un residuo ancora da incassare dal cliente.</p>
            <div className="mt-2 grid gap-1">
              {openBalances.map((d) => (
                <button
                  key={d.id}
                  className="flex items-center justify-between text-left text-sm hover:underline"
                  onClick={() => navigate(`/deals/${d.id}`)}
                >
                  <span className="text-slate-800">
                    {d.name}
                    {d.address ? ` — ${d.address}` : ""}
                  </span>
                  <span className="font-medium text-red-700">{formatCurrency(d.dueFromClient ?? 0, true)}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {overduePayments.length > 0 && (
        <Card className="mt-4 border-red-300 bg-red-50">
          <div className="px-4 py-3">
            <h2 className="text-sm font-semibold text-red-800">Pagamenti in ritardo</h2>
            <p className="text-xs text-red-700">Acconti/saldo con una scadenza impostata ormai passata e nessun importo ancora registrato.</p>
            <div className="mt-2 grid gap-1">
              {overduePayments.map(({ deal, label, dueDate }) => (
                <button
                  key={`${deal.id}-${label}`}
                  className="flex items-center justify-between text-left text-sm hover:underline"
                  onClick={() => navigate(`/deals/${deal.id}`)}
                >
                  <span className="text-slate-800">
                    {deal.name}
                    {deal.address ? ` — ${deal.address}` : ""} — {label}
                  </span>
                  <span className="font-medium text-red-700">scaduto il {formatDateIt(dueDate)}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      <DealSection
        title="Flip — acquisto e rivendita"
        deals={flipDeals}
        loading={deals.isLoading}
        emptyLabel="Nessun deal flip. Creane uno per iniziare."
        newDealLabel="+ Nuovo flip"
        operationType="FLIP"
        statusLabels={FLIP_STATUS_LABEL}
        onOpen={(id) => navigate(`/deals/${id}`)}
        onDelete={confirmDelete}
        deleteDeal={deleteDeal}
        createDeal={createDeal}
        stageAction={{ fromStatus: "VALUTAZIONE", toStatus: "ACQUISIZIONE", label: "Ho acquistato", mutation: markPurchased }}
      />

      <DealSection
        title="Ristrutturazioni per clienti — solo preventivo"
        deals={clientDeals}
        loading={deals.isLoading}
        emptyLabel="Nessuna ristrutturazione per cliente. Creane una per iniziare."
        newDealLabel="+ Nuova ristrutturazione"
        operationType="RISTRUTTURAZIONE_CLIENTE"
        statusLabels={CLIENT_STATUS_LABEL}
        onOpen={(id) => navigate(`/deals/${id}`)}
        onDelete={confirmDelete}
        deleteDeal={deleteDeal}
        createDeal={createDeal}
        stageAction={{
          fromStatus: "VALUTAZIONE",
          toStatus: "ACQUISIZIONE",
          label: "Preventivo confermato",
          mutation: markPurchased,
          extraData: { quoteStatus: "ACCETTATO" },
        }}
        showSort={false}
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
  statusLabels,
  onOpen,
  onDelete,
  deleteDeal,
  createDeal,
  stageAction,
  showSort = true,
  className = "mt-6",
}: {
  title: string;
  deals: DealSummary[];
  loading: boolean;
  emptyLabel: string;
  newDealLabel: string;
  operationType: "FLIP" | "RISTRUTTURAZIONE_CLIENTE";
  statusLabels: Record<string, string>;
  onOpen: (id: string) => void;
  onDelete: (deal: { id: string; name: string }) => void;
  deleteDeal: ReturnType<typeof trpc.deal.delete.useMutation>;
  createDeal: ReturnType<typeof trpc.deal.create.useMutation>;
  stageAction?: {
    fromStatus: string;
    toStatus: string;
    label: string;
    mutation: ReturnType<typeof trpc.deal.update.useMutation>;
    extraData?: Record<string, unknown>;
  };
  showSort?: boolean;
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
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        {showSort && (
          <Select className="max-w-xs" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            <option value="updated">Ordina per: ultimo aggiornamento</option>
            <option value="roi">Ordina per: ROI (scenario realistico)</option>
            <option value="netProfit">Ordina per: utile netto (scenario realistico)</option>
          </Select>
        )}
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
            statusLabel={statusLabels[deal.status] ?? deal.status}
            onOpen={() => onOpen(deal.id)}
            onDelete={() => onDelete(deal)}
            deleting={deleteDeal.isPending && deleteDeal.variables?.id === deal.id}
            onStageAction={
              stageAction && deal.status === stageAction.fromStatus
                ? () =>
                    stageAction.mutation.mutate({
                      id: deal.id,
                      status: stageAction.toStatus as DealSummary["status"],
                      ...stageAction.extraData,
                    })
                : undefined
            }
            stageActionLabel={stageAction?.label}
            stageActionPending={stageAction ? stageAction.mutation.isPending && stageAction.mutation.variables?.id === deal.id : false}
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
  statusLabel,
  onOpen,
  onDelete,
  deleting,
  onStageAction,
  stageActionLabel,
  stageActionPending,
}: {
  deal: DealSummary;
  statusLabel: string;
  onOpen: () => void;
  onDelete: () => void;
  deleting: boolean;
  onStageAction?: () => void;
  stageActionLabel?: string;
  stageActionPending?: boolean;
}) {
  return (
    <Card className="flex items-center hover:border-brand-300">
      <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-slate-900">{deal.name}</h3>
              <Badge tone={STATUS_TONE[deal.status]}>{statusLabel}</Badge>
              {deal.isDemo && <Badge tone="neutral">Demo</Badge>}
            </div>
            {deal.address && <p className="mt-1 text-sm text-slate-500">{deal.address}</p>}
          </div>
          {deal.summary ? (
            <div className="flex gap-6 text-right">
              <div>
                <div className="text-xs text-slate-400">{deal.summary.roi === null ? "Utile netto" : "Utile netto (realistico)"}</div>
                <div className="font-semibold text-slate-900">{formatCurrency(deal.summary.netProfit)}</div>
              </div>
              {deal.summary.roi !== null && (
                <div>
                  <div className="text-xs text-slate-400">ROI</div>
                  <div className={deal.summary.roi >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
                    {formatPercent(deal.summary.roi)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Badge tone="warning">Dati incompleti</Badge>
          )}
        </div>
      </button>
      <div className="mr-3 flex shrink-0 items-center gap-2">
        {onStageAction && (
          <Button variant="secondary" onClick={onStageAction} disabled={stageActionPending}>
            {stageActionLabel}
          </Button>
        )}
        <Button variant="ghost" className="text-red-600 hover:bg-red-50" title="Elimina deal" onClick={onDelete} disabled={deleting}>
          Elimina
        </Button>
      </div>
    </Card>
  );
}
