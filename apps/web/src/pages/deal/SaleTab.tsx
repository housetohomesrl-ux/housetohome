import { useState } from "react";
import { trpc } from "../../lib/trpc";
import type { DealDetail } from "../../lib/types";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Input, Label } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";

const SCENARIO_LABEL: Record<string, string> = {
  PRUDENTE: "Prudente",
  REALISTICO: "Realistico",
  OTTIMISTICO: "Ottimistico",
};

interface SharedSaleFields {
  vatRatePct: string;
  agencyFeesSellPct: string;
  agencyFeesSellFixed: string;
  agencyFeesSellVatRatePct: string;
  marketingStagingCosts: string;
  closingCosts: string;
}

function ScenarioForm({
  dealId,
  scenario,
  shared,
  setShared,
}: {
  dealId: string;
  scenario: DealDetail["saleScenarios"][number];
  shared: SharedSaleFields;
  setShared: (next: SharedSaleFields) => void;
}) {
  const utils = trpc.useUtils();
  const [estimatedSalePrice, setEstimatedSalePrice] = useState(scenario.estimatedSalePrice.toString());
  const upsert = trpc.saleScenario.upsert.useMutation({ onSuccess: () => utils.deal.get.invalidate({ id: dealId }) });

  return (
    <Card>
      <CardHeader title={SCENARIO_LABEL[scenario.scenario] ?? scenario.scenario} subtitle="Prezzo imponibile (IVA calcolata a parte)." />
      <CardBody className="grid gap-3">
        <div>
          <Label>Prezzo di vendita stimato (€, imponibile)</Label>
          <Input type="number" value={estimatedSalePrice} onChange={(e) => setEstimatedSalePrice(e.target.value)} />
          <p className="mt-1 text-xs text-slate-400">Unico campo diverso per scenario: tutti gli altri qui sotto si aggiornano insieme nei tre scenari.</p>
        </div>
        <div>
          <Label>IVA su vendita (%)</Label>
          <Input type="number" value={shared.vatRatePct} onChange={(e) => setShared({ ...shared, vatRatePct: e.target.value })} />
        </div>
        <div>
          <Label>Commissioni agenzia vendita (%)</Label>
          <Input
            type="number"
            value={shared.agencyFeesSellPct}
            onChange={(e) => setShared({ ...shared, agencyFeesSellPct: e.target.value })}
          />
        </div>
        <div>
          <Label>Commissioni agenzia vendita (€, importo fisso)</Label>
          <Input
            type="number"
            value={shared.agencyFeesSellFixed}
            onChange={(e) => setShared({ ...shared, agencyFeesSellFixed: e.target.value })}
          />
          <p className="mt-1 text-xs text-slate-400">Si somma alla percentuale sopra: usalo se l'agenzia fattura un importo fisso invece di una %.</p>
        </div>
        <div>
          <Label>IVA su commissioni agenzia (%, se fatturata)</Label>
          <Input
            type="number"
            value={shared.agencyFeesSellVatRatePct}
            onChange={(e) => setShared({ ...shared, agencyFeesSellVatRatePct: e.target.value })}
          />
        </div>
        <div>
          <Label>Marketing / home staging (€)</Label>
          <Input
            type="number"
            value={shared.marketingStagingCosts}
            onChange={(e) => setShared({ ...shared, marketingStagingCosts: e.target.value })}
          />
        </div>
        <div>
          <Label>Costi di chiusura (€)</Label>
          <Input type="number" value={shared.closingCosts} onChange={(e) => setShared({ ...shared, closingCosts: e.target.value })} />
        </div>
        <Button
          variant="secondary"
          disabled={upsert.isPending}
          onClick={() =>
            upsert.mutate({
              dealId,
              scenario: scenario.scenario,
              estimatedSalePrice: Number(estimatedSalePrice),
              vatRatePct: Number(shared.vatRatePct),
              agencyFeesSellPct: Number(shared.agencyFeesSellPct),
              agencyFeesSellFixed: Number(shared.agencyFeesSellFixed),
              agencyFeesSellVatRatePct: Number(shared.agencyFeesSellVatRatePct),
              marketingStagingCosts: Number(shared.marketingStagingCosts),
              closingCosts: Number(shared.closingCosts),
            })
          }
        >
          Salva
        </Button>
      </CardBody>
    </Card>
  );
}

export default function SaleTab({ deal }: { deal: DealDetail }) {
  const realistico = deal.saleScenarios.find((s) => s.scenario === "REALISTICO") ?? deal.saleScenarios[0];
  const [shared, setShared] = useState<SharedSaleFields>({
    vatRatePct: realistico?.vatRatePct.toString() ?? "0",
    agencyFeesSellPct: realistico?.agencyFeesSellPct.toString() ?? "3",
    agencyFeesSellFixed: realistico?.agencyFeesSellFixed.toString() ?? "0",
    agencyFeesSellVatRatePct: realistico?.agencyFeesSellVatRatePct.toString() ?? "0",
    marketingStagingCosts: realistico?.marketingStagingCosts.toString() ?? "0",
    closingCosts: realistico?.closingCosts.toString() ?? "0",
  });

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {deal.saleScenarios.map((s) => (
        <ScenarioForm key={s.id} dealId={deal.id} scenario={s} shared={shared} setShared={setShared} />
      ))}
    </div>
  );
}
