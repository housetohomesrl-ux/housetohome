import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Input, Label } from "../components/ui/Field";
import { Button } from "../components/ui/Button";

const EMPTY_FORM = { name: "", contact: "", email: "", specialty: "" };

export default function VendorsPage() {
  const utils = trpc.useUtils();
  const vendors = trpc.vendor.list.useQuery();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const create = trpc.vendor.create.useMutation({
    onSuccess: () => {
      utils.vendor.list.invalidate();
      setForm(EMPTY_FORM);
    },
  });
  const update = trpc.vendor.update.useMutation({
    onSuccess: () => {
      utils.vendor.list.invalidate();
      setForm(EMPTY_FORM);
      setEditingId(null);
    },
  });
  const remove = trpc.vendor.delete.useMutation({ onSuccess: () => utils.vendor.list.invalidate() });

  function startEdit(v: { id: string; name: string; contact: string | null; email: string | null; specialty: string | null }) {
    setEditingId(v.id);
    setForm({ name: v.name, contact: v.contact ?? "", email: v.email ?? "", specialty: v.specialty ?? "" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

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
                <th className="py-2 pr-2">Email</th>
                <th className="py-2 pr-2">Specializzazione</th>
                <th className="py-2 pr-2" />
              </tr>
            </thead>
            <tbody>
              {vendors.data?.map((v) => (
                <tr key={v.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2">{v.name}</td>
                  <td className="py-2 pr-2 text-slate-500">{v.contact}</td>
                  <td className="py-2 pr-2 text-slate-500">{v.email}</td>
                  <td className="py-2 pr-2 text-slate-500">{v.specialty}</td>
                  <td className="py-2 pr-2 text-right whitespace-nowrap">
                    <button className="text-xs text-brand-700 hover:underline" onClick={() => startEdit(v)}>
                      Modifica
                    </button>
                    <button className="ml-2 text-xs text-red-500 hover:underline" onClick={() => remove.mutate({ id: v.id })}>
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Contatto</Label>
              <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Specializzazione</Label>
              <Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
            </div>
            <div className="flex items-center gap-3 sm:col-span-4">
              <Button
                variant="secondary"
                disabled={!form.name || create.isPending || update.isPending}
                onClick={() => (editingId ? update.mutate({ id: editingId, ...form }) : create.mutate(form))}
              >
                {editingId ? "Salva modifiche" : "Aggiungi fornitore"}
              </Button>
              {editingId && (
                <button type="button" className="text-sm text-slate-500 hover:underline" onClick={cancelEdit}>
                  Annulla modifica
                </button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
