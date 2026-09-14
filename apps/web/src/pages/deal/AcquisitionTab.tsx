import { useState } from "react";
import { trpc } from "../../lib/trpc";
import type { DealDetail } from "../../lib/types";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Input, Label, Select } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";

const REGIME_LABEL: Record<string, string> = {
  PERSONA_FISICA: "Persona fisica (imposta sostitutiva su plusvalenza)",
  SOCIETA_CAPITALI: "Società di capitali (IRES + IRAP)",
  ALTRO: "Altro regime (gestito esternamente)",
};

export default function AcquisitionTab({ deal }: { deal: DealDetail }) {
  const utils = trpc.useUtils();
  const [purchasePrice, setPurchasePrice] = useState(deal.acquisitionDetails?.purchasePrice.toString() ?? "0");
  const [notes, setNotes] = useState(deal.acquisitionDetails?.notes ?? "");

  const [fiscal, setFiscal] = useState({
    regimeType: deal.fiscalSettings?.regimeType ?? "PERSONA_FISICA",
    saleSubjectToVat: deal.fiscalSettings?.saleSubjectToVat ?? false,
    costsVatRecoverable: deal.fiscalSettings?.costsVatRecoverable ?? false,
    iresRatePct: deal.fiscalSettings?.iresRatePct.toString() ?? "24",
    irapRatePct: deal.fiscalSettings?.irapRatePct.toString() ?? "3.9",
    capitalGainsTaxRatePct: deal.fiscalSettings?.capitalGainsTaxRatePct.toString() ?? "26",
  });

  const saveAcquisition = trpc.dealSettings.updateAcquisitionDetails.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });
  const saveFiscal = trpc.dealSettings.updateFiscalSettings.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader title="Dati di acquisizione" subtitle="Prezzo di acquisto: base per il calcolo della plusvalenza." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="purchasePrice">Prezzo di acquisto (€)</Label>
            <Input id="purchasePrice" type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="acqNotes">Note</Label>
            <Input id="acqNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <p className="text-xs text-slate-500 sm:col-span-2">
            Spese notarili, imposta di registro/IVA, commissioni agenzia e due diligence si inseriscono come righe di
            costo nella scheda Ristrutturazione (categoria "Acquisizione").
          </p>
          <div className="sm:col-span-2">
            <Button
              onClick={() =>
                saveAcquisition.mutate({ dealId: deal.id, purchasePrice: Number(purchasePrice), notes: notes || undefined })
              }
              disabled={saveAcquisition.isPending}
            >
              Salva
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Impostazioni fiscali del deal"
          subtitle="Regime IVA e imposte sull'operazione: incidono su tutti i calcoli di redditività."
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="regimeType">Regime fiscale</Label>
            <Select
              id="regimeType"
              value={fiscal.regimeType}
              onChange={(e) => setFiscal({ ...fiscal, regimeType: e.target.value as typeof fiscal.regimeType })}
            >
              {Object.entries(REGIME_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={fiscal.saleSubjectToVat}
              onChange={(e) => setFiscal({ ...fiscal, saleSubjectToVat: e.target.checked })}
            />
            Vendita soggetta a IVA
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={fiscal.costsVatRecoverable}
              onChange={(e) => setFiscal({ ...fiscal, costsVatRecoverable: e.target.checked })}
            />
            IVA sui costi recuperabile
          </label>

          {fiscal.regimeType === "SOCIETA_CAPITALI" && (
            <>
              <div>
                <Label htmlFor="ires">Aliquota IRES (%)</Label>
                <Input id="ires" type="number" value={fiscal.iresRatePct} onChange={(e) => setFiscal({ ...fiscal, iresRatePct: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="irap">Aliquota IRAP (%)</Label>
                <Input id="irap" type="number" value={fiscal.irapRatePct} onChange={(e) => setFiscal({ ...fiscal, irapRatePct: e.target.value })} />
              </div>
            </>
          )}
          {fiscal.regimeType === "PERSONA_FISICA" && (
            <div>
              <Label htmlFor="cgt">Aliquota imposta sostitutiva plusvalenza (%)</Label>
              <Input
                id="cgt"
                type="number"
                value={fiscal.capitalGainsTaxRatePct}
                onChange={(e) => setFiscal({ ...fiscal, capitalGainsTaxRatePct: e.target.value })}
              />
            </div>
          )}

          {fiscal.regimeType !== "ALTRO" && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:col-span-2">
              ⚠️ Le imposte calcolate da FlipPlan sono una STIMA basata sui campi sopra: la base imponibile fiscale
              reale può differire (capitalizzazioni, costi indeducibili, deducibilità dei costi incrementativi).
              Verifica sempre con il tuo commercialista prima di prendere decisioni economiche.
            </p>
          )}

          <div className="sm:col-span-2">
            <Button
              onClick={() =>
                saveFiscal.mutate({
                  dealId: deal.id,
                  regimeType: fiscal.regimeType as "PERSONA_FISICA" | "SOCIETA_CAPITALI" | "ALTRO",
                  saleSubjectToVat: fiscal.saleSubjectToVat,
                  costsVatRecoverable: fiscal.costsVatRecoverable,
                  iresRatePct: Number(fiscal.iresRatePct),
                  irapRatePct: Number(fiscal.irapRatePct),
                  capitalGainsTaxRatePct: Number(fiscal.capitalGainsTaxRatePct),
                })
              }
              disabled={saveFiscal.isPending}
            >
              Salva impostazioni fiscali
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
