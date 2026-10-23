import { useState } from "react";
import { trpc } from "../../lib/trpc";
import type { DealDetail } from "../../lib/types";
import { formatCurrency } from "../../lib/format";
import { CATASTALE_CATEGORIES, isLuxuryCategory } from "@flipplan/shared";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Input, Label, Select } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";

const PURCHASE_CATEGORY_LABEL: Record<string, string> = {
  PRIMA_CASA: "Prima casa (2% sulla rendita catastale)",
  SECONDA_CASA: "Seconda casa (9% sulla rendita catastale)",
};

// Suggerimento automatico (non il dato reale del Catasto) basato su parole
// chiave scritte in "Tipologia immobile", cosi la categoria catastale non
// resta vuota in attesa della visura: resta sempre modificabile a mano.
function guessCategoriaCatastale(propertyType: string): string {
  const t = propertyType.toLowerCase();
  if (t.includes("ufficio") || t.includes("studio")) return "A/10";
  if (t.includes("garage") || t.includes("box") || t.includes("autorimessa")) return "C/6";
  if (t.includes("magazzino") || t.includes("deposito") || t.includes("cantina")) return "C/2";
  if (t.includes("negozio") || t.includes("bottega")) return "C/1";
  if (t.includes("laboratorio")) return "C/3";
  if (t.includes("castello") || t.includes("palazzo")) return "A/9";
  if (t.includes("villa")) return "A/8";
  if (t.includes("villino")) return "A/7";
  if (t.includes("rurale") || t.includes("casale")) return "A/6";
  if (t.includes("appartamento") || t.includes("abitazione") || t.includes("casa")) return "A/2";
  return "";
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
    comune: deal.comune ?? "",
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
  const [imuRatePct, setImuRatePct] = useState(deal.acquisitionDetails?.imuRatePct?.toString() ?? "");
  const [categoriaCatastale, setCategoriaCatastale] = useState(deal.acquisitionDetails?.categoriaCatastale ?? "");
  const [ownStakePct, setOwnStakePct] = useState(deal.acquisitionDetails?.ownStakePct?.toString() ?? "100");
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
  // Il regime fiscale (scelto qui sotto, in Impostazioni fiscali) decide da
  // solo come si calcola l'imposta di registro: una società non ha il
  // beneficio "prima casa", paga sempre il 9% sul prezzo pieno. Solo per un
  // privato ha senso chiedere prima/seconda casa, ed è sempre calcolata
  // sulla rendita catastale (non sul prezzo dichiarato). Usiamo il regime
  // appena selezionato (non ancora salvato) così l'anteprima e il salvataggio
  // di acquisizione+imposta di registro avvengono insieme, in un click solo,
  // dal pulsante "Salva impostazioni fiscali".
  const isCompanyPurchase = fiscal.regimeType === "SOCIETA_CAPITALI";
  const isPrivatePurchase = fiscal.regimeType === "PERSONA_FISICA";
  const isPrimaCasaAgevolata = purchaseCategory === "PRIMA_CASA" && !isLuxuryCategory(categoriaCatastale);
  const estimatedRegistrationTax = isCompanyPurchase
    ? Number(purchasePrice || 0) * 0.09
    : isPrimaCasaAgevolata
      ? Number(renditaCatastale || 0) * 0.02
      : purchaseCategory === "SECONDA_CASA" || (purchaseCategory === "PRIMA_CASA" && isLuxuryCategory(categoriaCatastale))
        ? Number(renditaCatastale || 0) * 0.09
        : 0;
  const saveFiscal = trpc.dealSettings.updateFiscalSettings.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });
  function saveFiscalAndAcquisitionTax() {
    saveFiscal.mutate({
      dealId: deal.id,
      regimeType: fiscal.regimeType as "PERSONA_FISICA" | "SOCIETA_CAPITALI" | "ALTRO",
      saleSubjectToVat: fiscal.saleSubjectToVat,
      costsVatRecoverable: fiscal.costsVatRecoverable,
      iresRatePct: Number(fiscal.iresRatePct),
      irapRatePct: Number(fiscal.irapRatePct),
      capitalGainsTaxRatePct: Number(fiscal.capitalGainsTaxRatePct),
    });
    // Salva anche acquisizione (prezzo/rendita/tipo acquisto restano quelli già
    // impostati in Dati di acquisizione): serve perché il server ricalcola e
    // scrive l'imposta di registro nella riga "Notaio" leggendo sia il regime
    // fiscale sia questi campi — un solo click qui aggiorna entrambi.
    saveAcquisition.mutate({
      dealId: deal.id,
      purchasePrice: Number(purchasePrice),
      depositAmount: Number(depositAmount),
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      purchaseCategory: purchaseCategory || null,
      renditaCatastale: renditaCatastale ? Number(renditaCatastale) : null,
      imuRatePct: imuRatePct ? Number(imuRatePct) : null,
      categoriaCatastale: categoriaCatastale || null,
      ownStakePct: Number(ownStakePct || 100),
      notes: notes || undefined,
    });
  }

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
            <Label htmlFor="comune">Comune</Label>
            <Input
              id="comune"
              value={property.comune}
              onChange={(e) => setProperty({ ...property, comune: e.target.value })}
            />
            <p className="mt-1 text-xs text-slate-400">
              Comunicamelo in chat: ti cerco l'aliquota IMU di quel comune da mettere sotto in "Aliquota IMU del
              comune".
            </p>
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
              onChange={(e) => {
                const value = e.target.value;
                setProperty({ ...property, propertyType: value });
                if (!categoriaCatastale) {
                  const guess = guessCategoriaCatastale(value);
                  if (guess) setCategoriaCatastale(guess);
                }
              }}
            />
            <p className="mt-1 text-xs text-slate-400">
              Suggerisce in automatico una categoria catastale di partenza (scheda Acquisizione, sotto), da
              correggere quando arriva la visura reale.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Button
              onClick={() =>
                saveProperty.mutate({
                  id: deal.id,
                  address: property.address || undefined,
                  comune: property.comune || undefined,
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
            <div>
              <Label htmlFor="renditaCatastale">Rendita catastale (€)</Label>
              <Input
                id="renditaCatastale"
                type="number"
                value={renditaCatastale}
                onChange={(e) => setRenditaCatastale(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-400">
                Dalla visura catastale (RTI): se me la mandi in chat te la inserisco io. Se in fase di business plan
                non hai ancora la visura, lasciala vuota (o metti una stima): imposta di registro e IMU restano
                esclusi dal business plan finché non la compili, poi si aggiornano da soli.
              </p>
            </div>
            <div>
              <Label htmlFor="categoriaCatastale">Categoria catastale (all'acquisto)</Label>
              <Select
                id="categoriaCatastale"
                value={categoriaCatastale}
                onChange={(e) => setCategoriaCatastale(e.target.value)}
              >
                <option value="">— non impostata —</option>
                {Object.entries(CATASTALE_CATEGORIES).map(([code, info]) => (
                  <option key={code} value={code}>
                    {info.label}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-slate-400">
                Quella sulla visura al rogito, anche se poi ristrutturi e cambi destinazione d'uso (es. da magazzino
                ad abitazione). Da qui si calcolano in automatico l'eventuale esclusione dall'agevolazione prima casa
                (A/1, A/8, A/9) e il moltiplicatore corretto per la stima IMU in scheda Detenzione.
              </p>
            </div>
            <div>
              <Label htmlFor="imuRatePct">Aliquota IMU del comune (%)</Label>
              <Input
                id="imuRatePct"
                type="number"
                value={imuRatePct}
                onChange={(e) => setImuRatePct(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-400">
                Varia per comune (di solito 0,86%–1,06% per un immobile non prima casa). Serve solo a calcolarti una
                stima dell'IMU mensile in scheda Detenzione: non viene mai inserita da sola, tu scegli se usarla.
                (Hai messo il Comune in "Dati immobile"? Comunicamelo in chat e te la cerco io.)
              </p>
            </div>
            <div>
              <Label htmlFor="ownStakePct">Quota di partecipazione (%)</Label>
              <Input
                id="ownStakePct"
                type="number"
                value={ownStakePct}
                onChange={(e) => setOwnStakePct(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-400">
                100% se fai il flip da solo. Se lo fai insieme a un'altra società, imposta qui la tua quota (es. 50%
                in due, 33,3% se siete in tre): in scheda Risultati vedrai sia il costo/utile totale del progetto sia
                quello a tuo carico.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="acqNotes">Note</Label>
              <Input id="acqNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <p className="text-xs text-slate-500 sm:col-span-2">
              Spese notarili (onorario), agenzia e due diligence si inseriscono come righe di costo nella scheda
              Ristrutturazione (categoria "Acquisizione"). Con cosa fai l'acquisto (società o privato, prima/seconda
              casa) e il calcolo dell'imposta di registro si impostano qui sotto, in "Impostazioni fiscali del deal".
            </p>
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
                    imuRatePct: imuRatePct ? Number(imuRatePct) : null,
                    categoriaCatastale: categoriaCatastale || null,
                    ownStakePct: Number(ownStakePct || 100),
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
            <>
              <div>
                <Label htmlFor="cgt">Aliquota imposta sostitutiva plusvalenza (%)</Label>
                <Input
                  id="cgt"
                  type="number"
                  value={fiscal.capitalGainsTaxRatePct}
                  onChange={(e) => setFiscal({ ...fiscal, capitalGainsTaxRatePct: e.target.value })}
                />
              </div>
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
                  Acquisto da privato: l'imposta di registro si calcola sulla rendita catastale (scheda
                  Acquisizione), non sul prezzo.
                </p>
              </div>
              {isLuxuryCategory(categoriaCatastale) && (
                <p className="text-xs text-slate-400 sm:col-span-2">
                  Categoria catastale di lusso ({categoriaCatastale}, scheda Acquisizione): non ha mai diritto
                  all'agevolazione prima casa, anche con "Prima casa" selezionato sopra l'imposta di registro viene
                  calcolata sempre al 9% sulla rendita catastale.
                </p>
              )}
            </>
          )}

          {estimatedRegistrationTax > 0 && (!isPrivatePurchase || purchaseCategory) && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:col-span-2">
              {isCompanyPurchase
                ? "Acquisto con la società: imposta di registro stimata al 9% sul prezzo di acquisto"
                : isPrimaCasaAgevolata
                  ? "Prima casa: imposta di registro stimata al 2% sulla rendita catastale"
                  : purchaseCategory === "PRIMA_CASA"
                    ? "Immobile di lusso: niente agevolazione prima casa, imposta di registro stimata al 9% sulla rendita catastale"
                    : "Seconda casa: imposta di registro stimata al 9% sulla rendita catastale"}{" "}
              = {formatCurrency(estimatedRegistrationTax, true)}. Al Salva viene inserita in automatico
              nell'"Importo non imponibile" della riga di costo "Notaio" (categoria Acquisizione), in aggiunta
              all'imponibile che resta l'onorario del notaio.
            </p>
          )}

          {fiscal.regimeType !== "ALTRO" && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:col-span-2">
              ⚠️ Le imposte calcolate da FlipPlan sono una STIMA basata sui campi sopra: la base imponibile fiscale
              reale può differire (capitalizzazioni, costi indeducibili, deducibilità dei costi incrementativi).
              Verifica sempre con il tuo commercialista prima di prendere decisioni economiche.
            </p>
          )}

          <div className="sm:col-span-2">
            <Button onClick={saveFiscalAndAcquisitionTax} disabled={saveFiscal.isPending || saveAcquisition.isPending}>
              Salva impostazioni fiscali
            </Button>
          </div>
        </CardBody>
      </Card>
      )}
    </div>
  );
}
