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

function ScenarioForm({ dealId, scenario }: { dealId: string; scenario: DealDetail["saleScenarios"][number] }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    estimatedSalePrice: scenario.estimatedSalePrice.toString(),
    vatRatePct: scenario.vatRatePct.toString(),
    agencyFeesSellPct: scenario.agencyFeesSellPct.toString(),
    marketingStagingCosts: scenario.marketingStagingCosts.toString(),
    closingCosts: scenario.closingCosts.toString(),
  });
  const upsert = trpc.saleScenario.upsert.useMutation({ onSuccess: () => utils.deal.get.invalidate({ id: dealId }) });

  return (
    <Card>
      <CardHeader title={SCENARIO_LABEL[scenario.scenario] ?? scenario.scenario} subtitle="Prezzo imponibile (IVA calcolata a parte)." />
      <CardBody className="grid gap-3">
        <div>
          <Label>Prezzo di vendita stimato (€, imponibile)</Label>
          <Input type="number" value={form.estimatedSalePrice} onChange={(e) => setForm({ ...form, estimatedSalePrice: e.target.value })} />
        </div>
        <div>
          <Label>IVA su vendita (%)</Label>
          <Input type="number" value={form.vatRatePct} onChange={(e) => setForm({ ...form, vatRatePct: e.target.value })} />
        </div>
        <div>
          <Label>Commissioni agenzia vendita (%)</Label>
          <Input type="number" value={form.agencyFeesSellPct} onChange={(e) => setForm({ ...form, agencyFeesSellPct: e.target.value })} />
        </div>
        <div>
          <Label>Marketing / home staging (€)</Label>
          <Input type="number" value={form.marketingStagingCosts} onChange={(e) => setForm({ ...form, marketingStagingCosts: e.target.value })} />
        </div>
        <div>
          <Label>Costi di chiusura (€)</Label>
          <Input type="number" value={form.closingCosts} onChange={(e) => setForm({ ...form, closingCosts: e.target.value })} />
        </div>
        <Button
          variant="secondary"
          disabled={upsert.isPending}
          onClick={() =>
            upsert.mutate({
              dealId,
              scenario: scenario.scenario,
              estimatedSalePrice: Number(form.estimatedSalePrice),
              vatRatePct: Number(form.vatRatePct),
              agencyFeesSellPct: Number(form.agencyFeesSellPct),
              marketingStagingCosts: Number(form.marketingStagingCosts),
              closingCosts: Number(form.closingCosts),
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
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {deal.saleScenarios.map((s) => (
        <ScenarioForm key={s.id} dealId={deal.id} scenario={s} />
      ))}
    </div>
  );
}
