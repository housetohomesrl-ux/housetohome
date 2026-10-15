import { useMemo, useState } from "react";
import { trpc } from "../lib/trpc";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Field";
import { Button } from "../components/ui/Button";

const EMPTY_FORM = { name: "", address: "", taxCode: "", vatNumber: "", phone: "", email: "" };

/**
 * Agenda clienti (RISTRUTTURAZIONE_CLIENTE): si popola da sola ogni volta
 * che si salvano i "Dati cliente" di un deal (vedi AcquisitionTab), ma può
 * essere gestita anche direttamente da qui.
 */
export default function ClientsPage() {
  const utils = trpc.useUtils();
  const clients = trpc.clients.list.useQuery();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [addressFilter, setAddressFilter] = useState("");

  const create = trpc.clients.create.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      setForm(EMPTY_FORM);
    },
  });
  const update = trpc.clients.update.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      setForm(EMPTY_FORM);
      setEditingId(null);
    },
  });
  const remove = trpc.clients.delete.useMutation({ onSuccess: () => utils.clients.list.invalidate() });

  const addressOptions = useMemo(() => {
    const addresses = new Set((clients.data ?? []).map((c) => c.address).filter((a): a is string => Boolean(a)));
    return [...addresses].sort();
  }, [clients.data]);

  const filteredClients = (clients.data ?? []).filter((c) => {
    const matchesSearch = search.trim() ? c.name.toLowerCase().includes(search.trim().toLowerCase()) : true;
    const matchesAddress = addressFilter ? c.address === addressFilter : true;
    return matchesSearch && matchesAddress;
  });

  function startEdit(c: { id: string; name: string; address: string | null; taxCode: string | null; vatNumber: string | null; phone: string | null; email: string | null }) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      address: c.address ?? "",
      taxCode: c.taxCode ?? "",
      vatNumber: c.vatNumber ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Clienti</h1>
      <p className="mt-1 text-sm text-slate-500">
        Agenda clienti per le ristrutturazioni: si popola da sola ogni volta che salvi i "Dati cliente" di un deal.
      </p>

      <Card className="mt-4">
        <CardHeader title="Elenco clienti" />
        <CardBody>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="sm:w-64">
              <Label htmlFor="clientSearch">Cerca per nome</Label>
              <Input id="clientSearch" placeholder="Cerca..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="sm:w-64">
              <Label htmlFor="addressFilter">Filtra per indirizzo</Label>
              <Select id="addressFilter" value={addressFilter} onChange={(e) => setAddressFilter(e.target.value)}>
                <option value="">Tutti gli indirizzi</option>
                {addressOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <table className="mb-4 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2 pr-2">Nome</th>
                <th className="py-2 pr-2">Indirizzo</th>
                <th className="py-2 pr-2">Codice fiscale</th>
                <th className="py-2 pr-2">P.IVA</th>
                <th className="py-2 pr-2">Telefono</th>
                <th className="py-2 pr-2">Email</th>
                <th className="py-2 pr-2" />
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2">{c.name}</td>
                  <td className="py-2 pr-2 text-slate-500">{c.address}</td>
                  <td className="py-2 pr-2 text-slate-500">{c.taxCode}</td>
                  <td className="py-2 pr-2 text-slate-500">{c.vatNumber}</td>
                  <td className="py-2 pr-2 text-slate-500">{c.phone}</td>
                  <td className="py-2 pr-2 text-slate-500">{c.email}</td>
                  <td className="py-2 pr-2 text-right whitespace-nowrap">
                    <button className="text-xs text-brand-700 hover:underline" onClick={() => startEdit(c)}>
                      Modifica
                    </button>
                    <button className="ml-2 text-xs text-red-500 hover:underline" onClick={() => remove.mutate({ id: c.id })}>
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-sm text-slate-400">
                    Nessun cliente trovato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Nome e cognome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Indirizzo</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>Codice fiscale</Label>
              <Input value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value })} />
            </div>
            <div>
              <Label>P.IVA</Label>
              <Input value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} />
            </div>
            <div>
              <Label>Telefono</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="flex items-center gap-3 sm:col-span-3">
              <Button
                variant="secondary"
                disabled={!form.name || create.isPending || update.isPending}
                onClick={() => (editingId ? update.mutate({ id: editingId, ...form }) : create.mutate(form))}
              >
                {editingId ? "Salva modifiche" : "Aggiungi cliente"}
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
