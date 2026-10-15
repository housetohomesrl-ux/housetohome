import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatCurrency } from "../../lib/format";
import type { DealDetail } from "../../lib/types";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Input, Label } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { clientBasePrice, quoteVatRatePct } from "./RenovationTab";

/**
 * Preventivo da dare al cliente per un deal RISTRUTTURAZIONE_CLIENTE: elenca
 * le voci di costo con il prezzo già maggiorato (prezzo cliente impostato a
 * mano, altrimenti costo + ricarico % per Materiali/Lavorazioni), senza IVA
 * per voce. L'IVA si applica una sola volta sul totale, con l'aliquota
 * impostata qui sotto (10% privati, 22% società). Non mostra dati interni
 * come pagato/residuo.
 */
export default function PreventivoTab({ deal }: { deal: DealDetail }) {
  const utils = trpc.useUtils();
  const [vatPct, setVatPct] = useState(quoteVatRatePct(deal).toString());
  const saveVat = trpc.dealSettings.updateRenovationSettings.useMutation({
    onSuccess: () => utils.deal.get.invalidate({ id: deal.id }),
  });

  const items = deal.costLineItems.filter((i) => !i.isMemo);
  const rows = items.map((item) => ({ item, price: clientBasePrice(item, deal) }));
  const subtotal = rows.reduce((sum, r) => sum + r.price, 0);
  const currentVatPct = quoteVatRatePct(deal);
  const vatAmount = (subtotal * currentVatPct) / 100;
  const grandTotal = subtotal + vatAmount;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <p className="text-sm text-slate-500">
          Elenca le voci di costo con il prezzo già maggiorato (impostato nella scheda Ristrutturazione, o costo +
          ricarico % per Materiali/Lavorazioni), senza IVA per voce. Non mostra dati interni come pagato/residuo.
        </p>
        <Button variant="secondary" onClick={() => window.print()}>
          Stampa preventivo
        </Button>
      </div>

      <Card className="print:hidden">
        <CardHeader
          title="IVA del preventivo"
          subtitle="Un'unica aliquota sul totale: 10% per i privati (ristrutturazione edilizia), 22% per le società."
        />
        <CardBody className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="quoteVat">IVA (%)</Label>
            <Input id="quoteVat" type="number" className="w-28" value={vatPct} onChange={(e) => setVatPct(e.target.value)} />
          </div>
          <Button
            variant="secondary"
            disabled={saveVat.isPending}
            onClick={() =>
              saveVat.mutate({
                dealId: deal.id,
                contingencyPct: deal.renovationSettings?.contingencyPct ?? 12,
                materialMarkupPct: deal.renovationSettings?.materialMarkupPct,
                laborMarkupPct: deal.renovationSettings?.laborMarkupPct,
                quoteVatRatePct: Number(vatPct),
              })
            }
          >
            Salva
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`Preventivo — ${deal.name}`} subtitle={deal.address ?? undefined} />
        <CardBody>
          {(deal.clientName || deal.clientPhone || deal.clientEmail) && (
            <div className="mb-4 text-sm text-slate-600">
              {deal.clientName && (
                <div>
                  <span className="text-slate-400">Cliente:</span> {deal.clientName}
                </div>
              )}
              {deal.clientPhone && (
                <div>
                  <span className="text-slate-400">Telefono:</span> {deal.clientPhone}
                </div>
              )}
              {deal.clientEmail && (
                <div>
                  <span className="text-slate-400">Email:</span> {deal.clientEmail}
                </div>
              )}
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2 pr-2">Descrizione</th>
                <th className="py-2 pr-2">Categoria</th>
                <th className="py-2 pr-2 text-right">Prezzo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, price }) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2">{item.description}</td>
                  <td className="py-2 pr-2 text-slate-500">{item.category.name}</td>
                  <td className="py-2 pr-2 text-right font-medium">{formatCurrency(price, true)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-sm text-slate-400">
                    Nessuna voce ancora inserita nella scheda Ristrutturazione.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td className="py-2 pr-2" colSpan={2}>
                    Subtotale
                  </td>
                  <td className="py-2 pr-2 text-right">{formatCurrency(subtotal, true)}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-2" colSpan={2}>
                    IVA ({currentVatPct}%)
                  </td>
                  <td className="py-2 pr-2 text-right">{formatCurrency(vatAmount, true)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="py-2 pr-2" colSpan={2}>
                    Totale preventivo
                  </td>
                  <td className="py-2 pr-2 text-right">{formatCurrency(grandTotal, true)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
