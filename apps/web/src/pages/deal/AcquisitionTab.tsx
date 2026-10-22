import { useState } from "react";
import { trpc } from "../../lib/trpc";
import type { DealDetail } from "../../lib/types";
import { formatCurrency } from "../../lib/format";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Input, Label, Select } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";

const REGISTRATION_TAX_CATEGORY_NAME = "Imposta di registro / IVA acquisto";
const PURCHASE_CATEGORY_LABEL: Record<string, string> = {
  PRIMA_CASA: "Prima casa (2% sulla rendita catastale)",
  SECONDA_CASA: "Seconda casa (9% sulla rendita catastale)",
};
const COMPANY_REGISTRATION_TAX_DESCRIPTION = "Imposta di registro (9% prezzo di acquisto, acquisto con società)";
function privatePurchaseRegistrationTaxDescription(category: "PRIMA_CASA" | "SECONDA_CASA") {
  return category === "PRIMA_CASA"
    ? "Imposta di registro (2% rendita catastale, prima casa)"
    : "Imposta di registro (9% rendita catastale, seconda casa)";
}

const REGIME_LABEL: Record<string, string> = {
  PERSONA_FISICA: "Persona fisica (imposta sostitutiva su plusvalenza)",
  SOCIETA_CAPITALI: "Società di capitali (IRES + IRAP)",
  ALTRO: "Altro regime (gestito esternamente)",
};

export default function AcquisitionTab({ deal }: { deal: DealDetail }) {
  const utils = trpc.useUtils();
  const [property, setProperty] = useState({
    address: deal.address ?? "",
    propertyType: deal.propertyType ?? "",
    surfaceSqm: deal.surfaceSqm?.toString() ?? "",
    operationType: deal.operationType,
  });
  const [purchasePrice, setPurchasePrice] = useState(deal.acquisitionDetails?.purchasePrice.toString() ?? "0");
  const [depositAmount, setDepositAmount] = useState(deal.acquisitionDetails?.depositAmount?.toString() ?? "0");
  const [purchaseDate, setPurchaseDate] = useState(
    deal.acquisitionDetails?.purchaseDate ? deal.acquisitionDetails.purchaseDate.slice(0, 10) : "",
  );
  const [purchaseCategory, setPurchaseCategory] = useState<"" | "PRIMA_CASA" | "SECONDA_CASA">(
    deal.acquisitionDetails?.purchaseCategory ?? "",
  );
  const [renditaCatastale, setRenditaCatastale] = useState(
    deal.acquisitionDetails?.renditaCatastale?.toString() ?? "",
  );
  const [notes, setNotes] = useState(deal.acquisitionDetails?.notes ?? "");
  const [client, setClient] = useState({
    clientName: deal.clientName ?? "",
    clientAddress: deal.clientAddress ?? "",
    clientTaxCode: deal.clientTaxCode ?? "",
    clientVatNumber: deal.clientVatNumber ?? "",
    clientPhone: deal.clientPhone ?? "",
    clientEmail: deal.clientEmail ?? "",
    quoteDate: deal.quoteDate ? deal.quoteDate.slice(0, 10) : "",
    quoteValidUntil: deal.quoteValidUntil ? deal.quoteValidUntil.slice(0, 10) : "",
  });
  const isClientJob = deal.operationType === "RISTRUTTURAZIONE_CLIENTE";

  const saveProperty = trpc.deal.update.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });
  const saveClient = trpc.deal.update.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });
  const upsertClientDirectory = trpc.clients.upsertByName.useMutation({
    onSuccess: () => utils.clients.list.invalidate(),
  });

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
  const costCategories = trpc.costCategory.list.useQuery();
  const addRegistrationTax = trpc.costLineItem.create.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });
  // Il regime fiscale del deal (scheda sotto) decide da solo come si calcola
  // l'imposta di registro: una società non ha il beneficio "prima casa", paga
  // sempre il 9% sul prezzo pieno. Solo per un privato ha senso chiedere
  // prima/seconda casa, ed è sempre calcolata sulla rendita catastale (non
  // sul prezzo dichiarato).
  const regimeType = deal.fiscalSettings?.regimeType;
  const isCompanyPurchase = regimeType === "SOCIETA_CAPITALI";
  const isPrivatePurchase = regimeType === "PERSONA_FISICA";
  const estimatedRegistrationTax = isCompanyPurchase
    ? Number(purchasePrice || 0) * 0.09
    : purchaseCategory === "PRIMA_CASA"
      ? Number(renditaCatastale || 0) * 0.02
      : purchaseCategory === "SECONDA_CASA"
        ? Number(renditaCatastale || 0) * 0.09
        : 0;
  const registrationTaxDescription = isCompanyPurchase
    ? COMPANY_REGISTRATION_TAX_DESCRIPTION
    : purchaseCategory
      ? privatePurchaseRegistrationTaxDescription(purchaseCategory)
      : null;
  const registrationTaxCategory = costCategories.data?.find(
    (c) => c.group === "ACQUISIZIONE" && c.name === REGISTRATION_TAX_CATEGORY_NAME,
  );
  const registrationTaxAlreadyAdded =
    registrationTaxDescription !== null &&
    deal.costLineItems.some(
      (i) => i.category.group === "ACQUISIZIONE" && i.description === registrationTaxDescription,
    );
  const saveFiscal = trpc.dealSettings.updateFiscalSettings.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader title="Dati immobile" subtitle="Indirizzo e superficie: usati nel portafoglio e nei calcoli a mq." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="operationType">Tipo di operazione</Label>
            <Select
              id="operationType"
              value={property.operationType}
              onChange={(e) => setProperty({ ...property, operationType: e.target.value as typeof property.operationType })}
            >
              <option value="FLIP">Flip (acquisto, ristrutturazione, rivendita)</option>
              <option value="RISTRUTTURAZIONE_CLIENTE">Ristrutturazione per un cliente (genera un preventivo)</option>
            </Select>
            {property.operationType === "RISTRUTTURAZIONE_CLIENTE" && (
              <p className="mt-1 text-xs text-slate-400">
                Nella scheda Ristrutturazione potrai impostare, per ogni voce di Materiali/Lavorazioni, anche un
                "Prezzo cliente" diverso dal costo: serve per generare il preventivo da dare al cliente.
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="address">Indirizzo</Label>
            <Input
              id="address"
              value={property.address}
              onChange={(e) => setProperty({ ...property, address: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="surfaceSqm">Superficie (mq)</Label>
            <Input
              id="surfaceSqm"
              type="number"
              value={property.surfaceSqm}
              onChange={(e) => setProperty({ ...property, surfaceSqm: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="propertyType">Tipologia immobile</Label>
            <Input
              id="propertyType"
              placeholder='es. "Appartamento 3 locali"'
              value={property.propertyType}
              onChange={(e) => setProperty({ ...property, propertyType: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              onClick={() =>
                saveProperty.mutate({
                  id: deal.id,
                  address: property.address || undefined,
                  propertyType: property.propertyType || undefined,
                  surfaceSqm: property.surfaceSqm ? Number(property.surfaceSqm) : undefined,
                  operationType: property.operationType,
                })
              }
              disabled={saveProperty.isPending}
            >
              Salva
            </Button>
          </div>
        </CardBody>
      </Card>

      {isClientJob ? (
        <Card>
          <CardHeader
            title="Dati cliente"
            subtitle="Il committente a cui consegnare il preventivo dei lavori."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="clientName">Nome e cognome</Label>
              <Input
                id="clientName"
                value={client.clientName}
                onChange={(e) => setClient({ ...client, clientName: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="clientAddress">Indirizzo</Label>
              <Input
                id="clientAddress"
                value={client.clientAddress}
                onChange={(e) => setClient({ ...client, clientAddress: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="clientTaxCode">Codice fiscale</Label>
              <Input
                id="clientTaxCode"
                value={client.clientTaxCode}
                onChange={(e) => setClient({ ...client, clientTaxCode: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="clientVatNumber">P.IVA</Label>
              <Input
                id="clientVatNumber"
                value={client.clientVatNumber}
                onChange={(e) => setClient({ ...client, clientVatNumber: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="clientPhone">Telefono</Label>
              <Input
                id="clientPhone"
                value={client.clientPhone}
                onChange={(e) => setClient({ ...client, clientPhone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="clientEmail">Email</Label>
              <Input
                id="clientEmail"
                type="email"
                value={client.clientEmail}
                onChange={(e) => setClient({ ...client, clientEmail: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="quoteDate">Data creazione preventivo</Label>
              <Input
                id="quoteDate"
                type="date"
                value={client.quoteDate}
                onChange={(e) => setClient({ ...client, quoteDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="quoteValidUntil">Data validità preventivo</Label>
              <Input
                id="quoteValidUntil"
                type="date"
                value={client.quoteValidUntil}
                onChange={(e) => setClient({ ...client, quoteValidUntil: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                onClick={() => {
                  saveClient.mutate({
                    id: deal.id,
                    clientName: client.clientName || undefined,
                    clientAddress: client.clientAddress || undefined,
                    clientTaxCode: client.clientTaxCode || undefined,
                    clientVatNumber: client.clientVatNumber || undefined,
                    clientPhone: client.clientPhone || undefined,
                    clientEmail: client.clientEmail || undefined,
                    quoteDate: client.quoteDate ? new Date(client.quoteDate) : undefined,
                    quoteValidUntil: client.quoteValidUntil ? new Date(client.quoteValidUntil) : undefined,
                  });
                  if (client.clientName) {
                    upsertClientDirectory.mutate({
                      name: client.clientName,
                      address: client.clientAddress || undefined,
                      taxCode: client.clientTaxCode || undefined,
                      vatNumber: client.clientVatNumber || undefined,
                      phone: client.clientPhone || undefined,
                      email: client.clientEmail || undefined,
                    });
                  }
                }}
                disabled={saveClient.isPending}
              >
                Salva
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Dati di acquisizione" subtitle="Prezzo di acquisto: base per il calcolo della plusvalenza." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="depositAmount">Acconto / caparra (€)</Label>
              <Input id="depositAmount" type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="purchasePrice">Prezzo di acquisto (€)</Label>
              <Input id="purchasePrice" type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="purchaseDate">Data di acquisto</Label>
              <Input id="purchaseDate" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              <p className="mt-1 text-xs text-slate-400">
                Usata per calcolare in automatico la rata dei finanziamenti aziendali (scheda Finanziamento) nella
                finestra di durata di questo flip.
              </p>
            </div>
            {isPrivatePurchase && (
              <div>
                <Label htmlFor="purchaseCategory">Prima casa o seconda casa</Label>
                <Select
                  id="purchaseCategory"
                  value={purchaseCategory}
                  onChange={(e) => setPurchaseCategory(e.target.value as typeof purchaseCategory)}
                >
                  <option value="">— non impostato —</option>
                  {Object.entries(PURCHASE_CATEGORY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-slate-400">
                  Acquisto da privato: l'imposta di registro si calcola sulla rendita catastale, non sul prezzo.
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="renditaCatastale">Rendita catastale (€)</Label>
              <Input
                id="renditaCatastale"
                type="number"
                value={renditaCatastale}
                onChange={(e) => setRenditaCatastale(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-400">
                Dalla visura catastale (RTI): se me la mandi in chat te la inserisco io. Serve per l'imposta di
                registro (acquisto da privato) e per il calcolo IMU.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="acqNotes">Note</Label>
              <Input id="acqNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <p className="text-xs text-slate-500 sm:col-span-2">
              Spese notarili, agenzia e due diligence si inseriscono come righe di costo nella scheda Ristrutturazione
              (categoria "Acquisizione"). Il regime fiscale (scheda sotto) decide il calcolo dell'imposta di
              registro: "Società di capitali" = acquisto con la società (9% sul prezzo, sempre seconda casa);
              "Persona fisica" = acquisto da privato (prima/seconda casa sulla rendita catastale).
            </p>
            {registrationTaxDescription && estimatedRegistrationTax > 0 && (
              <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:col-span-2">
                {isCompanyPurchase
                  ? "Acquisto con la società: imposta di registro stimata al 9% sul prezzo di acquisto"
                  : purchaseCategory === "PRIMA_CASA"
                    ? "Prima casa: imposta di registro stimata al 2% sulla rendita catastale"
                    : "Seconda casa: imposta di registro stimata al 9% sulla rendita catastale"}{" "}
                = {formatCurrency(estimatedRegistrationTax, true)}.{" "}
                {registrationTaxAlreadyAdded ? (
                  "Già presente come riga di costo in Acquisizione."
                ) : (
                  <Button
                    variant="secondary"
                    className="mt-2"
                    disabled={!registrationTaxCategory || addRegistrationTax.isPending}
                    onClick={() => {
                      if (!registrationTaxCategory || !registrationTaxDescription) return;
                      addRegistrationTax.mutate({
                        dealId: deal.id,
                        categoryId: registrationTaxCategory.id,
                        description: registrationTaxDescription,
                        taxableAmount: 0,
                        vatRatePct: 0,
                        nonTaxableAmount: estimatedRegistrationTax,
                        order: deal.costLineItems.length,
                      });
                    }}
                  >
                    Aggiungi come riga di costo
                  </Button>
                )}
              </div>
            )}
            <div className="sm:col-span-2">
              <Button
                onClick={() =>
                  saveAcquisition.mutate({
                    dealId: deal.id,
                    purchasePrice: Number(purchasePrice),
                    depositAmount: Number(depositAmount),
                    purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
                    purchaseCategory: purchaseCategory || null,
                    renditaCatastale: renditaCatastale ? Number(renditaCatastale) : null,
                    notes: notes || undefined,
                  })
                }
                disabled={saveAcquisition.isPending}
              >
                Salva
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {!isClientJob && (
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
      )}
    </div>
  );
}
