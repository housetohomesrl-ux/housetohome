import { formatCurrency } from "../../lib/format";
import type { DealDetail } from "../../lib/types";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { autoClientPrice } from "./RenovationTab";

/**
 * Preventivo da dare al cliente per un deal RISTRUTTURAZIONE_CLIENTE: elenca
 * le voci di costo con il "prezzo cliente" (se impostato a mano, altrimenti
 * costo + ricarico % per Materiali/Lavorazioni) e il relativo totale con
 * IVA. Non mostra pagato/residuo né la porzione fuori campo IVA, che sono
 * dati di tracciamento interno.
 */
export default function PreventivoTab({ deal }: { deal: DealDetail }) {
  const items = deal.costLineItems.filter((i) => !i.isMemo);
  const rows = items.map((item) => {
    const price = item.clientPrice ?? autoClientPrice(item, deal);
    const vat = (price * item.vatRatePct) / 100;
    return { item, price, vat, total: price + vat };
  });
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-slate-500">
          Elenca le voci di costo con il "Prezzo cliente" impostato nella scheda Ristrutturazione (se una voce non ne
          ha uno, usa costo + ricarico % per Materiali/Lavorazioni). Non mostra dati interni come pagato/residuo.
        </p>
        <Button variant="secondary" onClick={() => window.print()}>
          Stampa preventivo
        </Button>
      </div>

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
                <th className="py-2 pr-2 text-right">IVA%</th>
                <th className="py-2 pr-2 text-right">Totale</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, price, total }) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2">{item.description}</td>
                  <td className="py-2 pr-2 text-slate-500">{item.category.name}</td>
                  <td className="py-2 pr-2 text-right">{formatCurrency(price, true)}</td>
                  <td className="py-2 pr-2 text-right">{item.vatRatePct}%</td>
                  <td className="py-2 pr-2 text-right font-medium">{formatCurrency(total, true)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-slate-400">
                    Nessuna voce ancora inserita nella scheda Ristrutturazione.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-2 pr-2" colSpan={4}>
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
