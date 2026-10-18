import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { formatCurrency } from "../lib/format";
import { formatDateIt } from "./deal/PreventivoTab";
import { Card, CardBody } from "../components/ui/Card";

/**
 * Utili dei deal Ristrutturazione per un cliente CONCLUSI (status "Chiuso"):
 * una riga per deal, calcolata in automatico — niente fatturato (non c'è
 * vendita di un immobile), solo utile lordo e utile netto (tasse già
 * pagate) sulla ristrutturazione.
 */
export default function RevenueRistrutturazionePage() {
  const navigate = useNavigate();
  const revenue = trpc.revenue.ristrutturazione.useQuery();
  const rows = revenue.data?.rows ?? [];

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Fatturato Ristrutturazioni</h1>
      <p className="mt-1 text-sm text-slate-500">
        Ristrutturazioni per un cliente concluse: utile lordo e utile netto (tasse già pagate) sulla ristrutturazione.
      </p>

      <Card className="mt-4">
        <CardBody>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2 pr-2">Deal</th>
                <th className="py-2 pr-2">Indirizzo</th>
                <th className="py-2 pr-2">Concluso il</th>
                <th className="py-2 pr-2 text-right">Utile lordo</th>
                <th className="py-2 pr-2 text-right">Utile netto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                  onClick={() => navigate(`/deals/${r.id}`)}
                >
                  <td className="py-2 pr-2 font-medium text-slate-800">{r.name}</td>
                  <td className="py-2 pr-2 text-slate-500">{r.address ?? "—"}</td>
                  <td className="py-2 pr-2 text-slate-500">{formatDateIt(r.updatedAt)}</td>
                  <td className={`py-2 pr-2 text-right ${r.utileLordo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(r.utileLordo, true)}
                  </td>
                  <td className={`py-2 pr-2 text-right font-semibold ${r.utileNetto >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(r.utileNetto, true)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                    Nessuna ristrutturazione conclusa ancora. Un deal compare qui quando il suo stato passa a "Concluso".
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && revenue.data && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td className="py-2 pr-2" colSpan={3}>
                    Totale
                  </td>
                  <td className="py-2 pr-2 text-right">{formatCurrency(revenue.data.totals.utileLordo, true)}</td>
                  <td className="py-2 pr-2 text-right">{formatCurrency(revenue.data.totals.utileNetto, true)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
