import { useState } from "react";
import { useParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { Tabs } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import { Select } from "../components/ui/Field";
import { FLIP_STATUS_LABEL, CLIENT_STATUS_LABEL } from "../lib/dealStatus";
import type { DealDetail } from "../lib/types";
import AcquisitionTab from "./deal/AcquisitionTab";
import RenovationTab from "./deal/RenovationTab";
import HoldingTab from "./deal/HoldingTab";
import FinancingTab from "./deal/FinancingTab";
import SaleTab from "./deal/SaleTab";
import ResultsTab from "./deal/ResultsTab";
import ClientResultsTab from "./deal/ClientResultsTab";
import PreventivoTab from "./deal/PreventivoTab";
import VendorContractsTab from "./deal/VendorContractsTab";
import SiteListTab from "./deal/SiteListTab";
import SiteSurveyTab from "./deal/SiteSurveyTab";
import BusinessPlanTab from "./deal/BusinessPlanTab";

export default function DealDetailPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const [activeTab, setActiveTab] = useState("acquisizione");
  const utils = trpc.useUtils();
  const deal = trpc.deal.get.useQuery({ id: dealId! }, { enabled: Boolean(dealId) });
  const updateStatus = trpc.deal.update.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: dealId! }),
  });

  if (deal.isLoading) return <p className="text-sm text-slate-400">Caricamento...</p>;
  if (deal.isError || !deal.data) return <p className="text-sm text-red-600">Deal non trovato.</p>;

  const openWarnings = deal.data.notes.filter((n) => !n.isResolved && n.severity !== "INFO").length;
  const isClientJob = deal.data.operationType === "RISTRUTTURAZIONE_CLIENTE";
  const baseTabs = [
    { id: "acquisizione", label: isClientJob ? "Cliente" : "Acquisizione" },
    { id: "sopralluogo", label: "Lista sopralluogo" },
    { id: "ristrutturazione", label: "Ristrutturazione" },
    { id: "lista-cantiere", label: "Lista cantiere" },
    { id: "detenzione", label: "Detenzione" },
    ...(isClientJob ? [] : [{ id: "finanziamento", label: "Finanziamento" }, { id: "vendita", label: "Vendita" }]),
    { id: "risultati", label: "Risultati" },
  ];
  const tabs = isClientJob
    ? [...baseTabs, { id: "preventivo", label: "Preventivo cliente" }, { id: "contratti-fornitori", label: "Contratti fornitori" }]
    : [
        ...baseTabs,
        { id: "contratti-fornitori", label: "Contratti fornitori" },
        { id: "business-plan", label: "Business plan" },
      ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <h1 className="text-xl font-semibold text-slate-900">{deal.data.name}</h1>
        {deal.data.isDemo && <Badge tone="neutral">Demo</Badge>}
        {openWarnings > 0 && <Badge tone="warning">{openWarnings} avvisi aperti</Badge>}
        <Select
          className="w-52"
          value={deal.data.status}
          onChange={(e) =>
            updateStatus.mutate({ id: deal.data!.id, status: e.target.value as DealDetail["status"] })
          }
        >
          {Object.entries(isClientJob ? CLIENT_STATUS_LABEL : FLIP_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      {deal.data.address && <p className="mt-1 text-sm text-slate-500 print:hidden">{deal.data.address}</p>}

      <div className="mt-4">
        <Tabs items={tabs} activeId={activeTab} onChange={setActiveTab} />
      </div>

      <div className="mt-5">
        {activeTab === "acquisizione" && <AcquisitionTab deal={deal.data} />}
        {activeTab === "ristrutturazione" && <RenovationTab deal={deal.data} />}
        {activeTab === "lista-cantiere" && <SiteListTab deal={deal.data} />}
        {activeTab === "detenzione" && <HoldingTab deal={deal.data} />}
        {activeTab === "finanziamento" && <FinancingTab deal={deal.data} />}
        {activeTab === "vendita" && <SaleTab deal={deal.data} />}
        {activeTab === "risultati" && (isClientJob ? <ClientResultsTab deal={deal.data} /> : <ResultsTab deal={deal.data} />)}
        {activeTab === "sopralluogo" && <SiteSurveyTab deal={deal.data} />}
        {activeTab === "preventivo" && isClientJob && <PreventivoTab deal={deal.data} />}
        {activeTab === "contratti-fornitori" && <VendorContractsTab deal={deal.data} />}
        {activeTab === "business-plan" && !isClientJob && <BusinessPlanTab deal={deal.data} />}
      </div>
    </div>
  );
}
