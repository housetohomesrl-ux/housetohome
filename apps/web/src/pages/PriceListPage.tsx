import { useState } from "react";
import { trpc } from "../lib/trpc";
import { formatCurrency } from "../lib/format";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Field";
import { Button } from "../components/ui/Button";

export default function PriceListPage() {
  const utils = trpc.useUtils();
  const items = trpc.priceListItem.list.useQuery();
  const categories = trpc.costCategory.list.useQuery();
  const [form, setForm] = useState({ categoryId: "", name: "", unit: "", unitPrice: "0" });

  const create = trpc.priceListItem.create.useMutation({
    onSuccess: () => {
      utils.priceListItem.list.invalidate();
      setForm({ categoryId: "", name: "", unit: "", unitPrice: "0" });
    },
  });
  const remove = trpc.priceListItem.delete.useMutation({ onSuccess: () => utils.priceListItem.list.invalidate() });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Libreria prezzi</h1>
      <p className="mt-1 text-sm text-slate-500">
        Il tuo listino personale per categoria di lavoro: si arricchisce nel tempo e velocizza i preventivi futuri.
      </p>

      <Card className="mt-4">
        <CardHeader title="Voci di listino" />
        <CardBody>
          <table className="mb-4 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2 pr-2">Voce</th>
                <th className="py-2 pr-2">Categoria</th>
                <th className="py-2 pr-2">Unità</th>
                <th className="py-2 pr-2 text-right">Prezzo unitario</th>
                <th className="py-2 pr-2" />
              </tr>
            </thead>
            <tbody>
              {items.data?.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2">{item.name}</td>
                  <td className="py-2 pr-2 text-slate-500">{item.category.name}</td>
                  <td className="py-2 pr-2 text-slate-500">{item.unit}</td>
                  <td className="py-2 pr-2 text-right">{formatCurrency(item.unitPrice, true)}</td>
                  <td className="py-2 pr-2 text-right">
                    <button className="text-xs text-red-500 hover:underline" onClick={() => remove.mutate({ id: item.id })}>
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">Seleziona...</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Voce</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Unità (mq, cad, ml...)</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div>
              <Label>Prezzo unitario (€)</Label>
              <Input type="number" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
            </div>
            <div className="sm:col-span-4">
              <Button
                variant="secondary"
                disabled={!form.categoryId || !form.name || create.isPending}
                onClick={() => create.mutate({ ...form, unitPrice: Number(form.unitPrice) })}
              >
                Aggiungi voce
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
