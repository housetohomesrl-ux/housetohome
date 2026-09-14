import { useState } from "react";
import { useParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { Tabs } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import AcquisitionTab from "./deal/AcquisitionTab";
import RenovationTab from "./deal/RenovationTab";
import HoldingTab from "./deal/HoldingTab";
import FinancingTab from "./deal/FinancingTab";
import SaleTab from "./deal/SaleTab";
import ResultsTab from "./deal/ResultsTab";

const TABS = [
  { id: "acquisizione", label: "Acquisizione" },
  { id: "ristrutturazione", label: "Ristrutturazione" },
  { id: "detenzione", label: "Detenzione" },
  { id: "finanziamento", label: "Finanziamento" },
  { id: "vendita", label: "Vendita" },
  { id: "risultati", label: "Risultati" },
];

export default function DealDetailPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const [activeTab, setActiveTab] = useState("acquisizione");
  const deal = trpc.deal.get.useQuery({ id: dealId! }, { enabled: Boolean(dealId) });

  if (deal.isLoading) return <p className="text-sm text-slate-400">Caricamento...</p>;
  if (deal.isError || !deal.data) return <p className="text-sm text-red-600">Deal non trovato.</p>;

  const openWarnings = deal.data.notes.filter((n) => !n.isResolved && n.severity !== "INFO").length;

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{deal.data.name}</h1>
        {deal.data.isDemo && <Badge tone="neutral">Demo</Badge>}
        {openWarnings > 0 && <Badge tone="warning">{openWarnings} avvisi aperti</Badge>}
      </div>
      {deal.data.address && <p className="mt-1 text-sm text-slate-500">{deal.data.address}</p>}

      <div className="mt-4">
        <Tabs items={TABS} activeId={activeTab} onChange={setActiveTab} />
      </div>

      <div className="mt-5">
        {activeTab === "acquisizione" && <AcquisitionTab deal={deal.data} />}
        {activeTab === "ristrutturazione" && <RenovationTab deal={deal.data} />}
        {activeTab === "detenzione" && <HoldingTab deal={deal.data} />}
        {activeTab === "finanziamento" && <FinancingTab deal={deal.data} />}
        {activeTab === "vendita" && <SaleTab deal={deal.data} />}
        {activeTab === "risultati" && <ResultsTab deal={deal.data} />}
      </div>
    </div>
  );
}
