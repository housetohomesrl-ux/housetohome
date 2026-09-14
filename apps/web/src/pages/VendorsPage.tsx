import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Input, Label } from "../components/ui/Field";
import { Button } from "../components/ui/Button";

export default function VendorsPage() {
  const utils = trpc.useUtils();
  const vendors = trpc.vendor.list.useQuery();
  const [form, setForm] = useState({ name: "", contact: "", specialty: "" });
  const create = trpc.vendor.create.useMutation({
    onSuccess: () => {
      utils.vendor.list.invalidate();
      setForm({ name: "", contact: "", specialty: "" });
    },
  });
  const remove = trpc.vendor.delete.useMutation({ onSuccess: () => utils.vendor.list.invalidate() });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Fornitori</h1>
      <p className="mt-1 text-sm text-slate-500">Anagrafica riutilizzabile su tutti i tuoi deal.</p>

      <Card className="mt-4">
        <CardHeader title="Elenco fornitori" />
        <CardBody>
          <table className="mb-4 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2 pr-2">Nome</th>
                <th className="py-2 pr-2">Contatto</th>
                <th className="py-2 pr-2">Specializzazione</th>
                <th className="py-2 pr-2" />
              </tr>
            </thead>
            <tbody>
              {vendors.data?.map((v) => (
                <tr key={v.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2">{v.name}</td>
                  <td className="py-2 pr-2 text-slate-500">{v.contact}</td>
                  <td className="py-2 pr-2 text-slate-500">{v.specialty}</td>
                  <td className="py-2 pr-2 text-right">
                    <button className="text-xs text-red-500 hover:underline" onClick={() => remove.mutate({ id: v.id })}>
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Contatto</Label>
              <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </div>
            <div>
              <Label>Specializzazione</Label>
              <Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
            </div>
            <div className="sm:col-span-3">
              <Button variant="secondary" disabled={!form.name || create.isPending} onClick={() => create.mutate(form)}>
                Aggiungi fornitore
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
