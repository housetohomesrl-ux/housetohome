import { useState } from "react";
import { trpc } from "../../lib/trpc";
import type { DealDetail } from "../../lib/types";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Input, Label } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";

export default function HoldingTab({ deal }: { deal: DealDetail }) {
  const utils = trpc.useUtils();
  const h = deal.holdingCosts;
  const [form, setForm] = useState({
    durationMonths: h?.durationMonths.toString() ?? "6",
    monthlyInsurance: h?.monthlyInsurance.toString() ?? "0",
    monthlyUtilities: h?.monthlyUtilities.toString() ?? "0",
    monthlyPropertyTax: h?.monthlyPropertyTax.toString() ?? "0",
    monthlyCondoFees: h?.monthlyCondoFees.toString() ?? "0",
    otherMonthlyCosts: h?.otherMonthlyCosts.toString() ?? "0",
  });

  const save = trpc.dealSettings.updateHoldingCosts.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });

  return (
    <Card>
      <CardHeader
        title="Costi di detenzione (holding costs)"
        subtitle="Costi fissi ricorrenti per la durata stimata del progetto. Gli interessi sui finanziamenti si inseriscono nella scheda Finanziamento."
      />
      <CardBody className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="durationMonths">Durata stimata (mesi)</Label>
          <Input
            id="durationMonths"
            type="number"
            value={form.durationMonths}
            onChange={(e) => setForm({ ...form, durationMonths: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="insurance">Assicurazione (€/mese)</Label>
          <Input id="insurance" type="number" value={form.monthlyInsurance} onChange={(e) => setForm({ ...form, monthlyInsurance: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="utilities">Utenze (€/mese)</Label>
          <Input id="utilities" type="number" value={form.monthlyUtilities} onChange={(e) => setForm({ ...form, monthlyUtilities: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="propertyTax">IMU (€/mese)</Label>
          <Input id="propertyTax" type="number" value={form.monthlyPropertyTax} onChange={(e) => setForm({ ...form, monthlyPropertyTax: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="condo">Spese condominiali (€/mese)</Label>
          <Input id="condo" type="number" value={form.monthlyCondoFees} onChange={(e) => setForm({ ...form, monthlyCondoFees: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="other">Altri costi (€/mese)</Label>
          <Input id="other" type="number" value={form.otherMonthlyCosts} onChange={(e) => setForm({ ...form, otherMonthlyCosts: e.target.value })} />
        </div>
        <div className="sm:col-span-3">
          <Button
            onClick={() =>
              save.mutate({
                dealId: deal.id,
                durationMonths: Number(form.durationMonths),
                monthlyInsurance: Number(form.monthlyInsurance),
                monthlyUtilities: Number(form.monthlyUtilities),
                monthlyPropertyTax: Number(form.monthlyPropertyTax),
                monthlyCondoFees: Number(form.monthlyCondoFees),
                otherMonthlyCosts: Number(form.otherMonthlyCosts),
              })
            }
            disabled={save.isPending}
          >
            Salva
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
