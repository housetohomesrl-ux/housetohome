import { useRef, useState } from "react";
import { trpc } from "../lib/trpc";
import { formatCurrency, formatDate } from "../lib/format";
import { parseCsvWithHeader } from "../lib/csv";
import { costCategoryGroupSchema } from "@flipplan/shared";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Input, Label, Select, Textarea } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

interface ImportRow {
  categoryGroup: "ACQUISIZIONE" | "MATERIALI" | "LAVORAZIONI" | "ENTI_ESTERNI" | "ALTRO";
  categoryName: string;
  name: string;
  unit?: string;
  unitPrice: number;
  vendorName?: string;
  specification?: string;
  referenceQuantity?: string;
  notes?: string;
}

const EMPTY_FORM = {
  categoryId: "",
  name: "",
  unit: "",
  unitPrice: "0",
  vendorId: "",
  specification: "",
  referenceQuantity: "",
  notes: "",
  includeInPreventivo: true,
  includeInBusinessPlan: false,
};

export default function PriceListPage() {
  const utils = trpc.useUtils();
  const items = trpc.priceListItem.list.useQuery();
  const categories = trpc.costCategory.list.useQuery();
  const vendors = trpc.vendor.list.useQuery();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const create = trpc.priceListItem.create.useMutation({
    onSuccess: () => {
      utils.priceListItem.list.invalidate();
      setForm(EMPTY_FORM);
    },
  });
  const remove = trpc.priceListItem.delete.useMutation({ onSuccess: () => utils.priceListItem.list.invalidate() });
  const update = trpc.priceListItem.update.useMutation({
    onSuccess: () => {
      utils.priceListItem.list.invalidate();
      setForm(EMPTY_FORM);
      setEditingId(null);
    },
  });

  function startEdit(item: NonNullable<typeof items.data>[number]) {
    setEditingId(item.id);
    setForm({
      categoryId: item.categoryId,
      name: item.name,
      unit: item.unit ?? "",
      unitPrice: item.unitPrice.toString(),
      vendorId: item.vendorId ?? "",
      specification: item.specification ?? "",
      referenceQuantity: item.referenceQuantity ?? "",
      notes: item.notes ?? "",
      includeInPreventivo: item.includeInPreventivo,
      includeInBusinessPlan: item.includeInBusinessPlan,
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    created: number;
    skipped: number;
    categoriesCreated: number;
    vendorsCreated: number;
    failed: { name: string; error: string }[];
  } | null>(null);

  const bulkImport = trpc.priceListItem.bulkImport.useMutation({
    onSuccess: (result) => {
      utils.priceListItem.list.invalidate();
      utils.costCategory.list.invalidate();
      utils.vendor.list.invalidate();
      setImportResult(result);
      setImportRows(null);
    },
  });

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const rows = parseCsvWithHeader(text);
        const parsed: ImportRow[] = rows.map((r, i) => {
          const group = costCategoryGroupSchema.safeParse(r.group?.toUpperCase());
          if (!group.success) throw new Error(`Riga ${i + 2}: gruppo "${r.group}" non valido (usa ACQUISIZIONE/MATERIALI/LAVORAZIONI/ENTI_ESTERNI/ALTRO)`);
          if (!r.category) throw new Error(`Riga ${i + 2}: categoria mancante`);
          if (!r.name) throw new Error(`Riga ${i + 2}: nome voce mancante`);
          const unitPrice = Number(r.unitPrice);
          if (Number.isNaN(unitPrice)) throw new Error(`Riga ${i + 2}: prezzo "${r.unitPrice}" non è un numero`);
          return {
            categoryGroup: group.data,
            categoryName: r.category,
            name: r.name,
            unit: r.unit || undefined,
            unitPrice,
            vendorName: r.vendor || undefined,
            specification: r.specification || undefined,
            referenceQuantity: r.referenceQuantity || undefined,
            notes: r.notes || undefined,
          };
        });
        setImportRows(parsed);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "File non leggibile");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Libreria prezzi</h1>
      <p className="mt-1 text-sm text-slate-500">
        Il tuo listino personale per categoria di lavoro: si arricchisce nel tempo e velocizza i preventivi futuri.
        Ogni voce può essere richiamata direttamente quando aggiungi un costo a un deal.
      </p>

      <Card className="mt-4">
        <CardHeader
          title="Importa da CSV"
          subtitle="Colonne: group, category, name, unit, unitPrice, vendor, specification, referenceQuantity, notes (tutte opzionali tranne le prime quattro)."
        />
        <CardBody>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileSelected}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Scegli file CSV
            </Button>
            {importRows && <span className="text-sm text-slate-600">{importRows.length} righe pronte da importare</span>}
            {importRows && (
              <Button disabled={bulkImport.isPending} onClick={() => bulkImport.mutate({ items: importRows })}>
                {bulkImport.isPending ? "Importazione..." : `Conferma importazione (${importRows.length})`}
              </Button>
            )}
          </div>
          {importError && <p className="mt-2 text-sm text-red-600">{importError}</p>}
          {importResult && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="success">{importResult.created} create</Badge>
              {importResult.categoriesCreated > 0 && <Badge tone="info">{importResult.categoriesCreated} nuove categorie</Badge>}
              {importResult.vendorsCreated > 0 && <Badge tone="info">{importResult.vendorsCreated} nuovi fornitori</Badge>}
              {importResult.skipped > 0 && <Badge tone="neutral">{importResult.skipped} già presenti (saltate)</Badge>}
              {importResult.failed.length > 0 && <Badge tone="danger">{importResult.failed.length} fallite</Badge>}
            </div>
          )}
          {importResult && importResult.failed.length > 0 && (
            <ul className="mt-2 text-xs text-red-600">
              {importResult.failed.map((f) => (
                <li key={f.name}>
                  {f.name}: {f.error}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Voci di listino" />
        <CardBody>
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                  <th className="py-2 pr-2">Voce</th>
                  <th className="py-2 pr-2">Categoria</th>
                  <th className="py-2 pr-2">Fornitore</th>
                  <th className="py-2 pr-2">Unità / rif.</th>
                  <th className="py-2 pr-2 text-right">Prezzo</th>
                  <th className="py-2 pr-2">Usa per</th>
                  <th className="py-2 pr-2">Aggiornato</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {items.data?.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-2">
                      <div>{item.name}</div>
                      {item.specification && <div className="mt-0.5 text-xs text-slate-400">{item.specification}</div>}
                    </td>
                    <td className="py-2 pr-2 text-slate-500">{item.category.name}</td>
                    <td className="py-2 pr-2 text-slate-500">{item.vendor?.name ?? "—"}</td>
                    <td className="py-2 pr-2 text-slate-500">
                      <div>{item.unit}</div>
                      {item.referenceQuantity && <div className="mt-0.5 text-xs text-slate-400">{item.referenceQuantity}</div>}
                    </td>
                    <td className="py-2 pr-2 text-right font-medium">{formatCurrency(item.unitPrice, true)}</td>
                    <td className="py-2 pr-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          className="cursor-pointer"
                          title="Clic per attivare/disattivare"
                          onClick={() => update.mutate({ id: item.id, includeInPreventivo: !item.includeInPreventivo })}
                        >
                          <Badge tone={item.includeInPreventivo ? "success" : "neutral"}>Preventivo</Badge>
                        </button>
                        <button
                          className="cursor-pointer"
                          title="Clic per attivare/disattivare"
                          onClick={() => update.mutate({ id: item.id, includeInBusinessPlan: !item.includeInBusinessPlan })}
                        >
                          <Badge tone={item.includeInBusinessPlan ? "info" : "neutral"}>Business plan</Badge>
                        </button>
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-xs text-slate-400">{formatDate(item.updatedAt)}</td>
                    <td className="py-2 pr-2 text-right whitespace-nowrap">
                      <button className="text-xs text-brand-700 hover:underline" onClick={() => startEdit(item)}>
                        Modifica
                      </button>
                      <button
                        className="ml-2 text-xs text-red-500 hover:underline"
                        onClick={() => remove.mutate({ id: item.id })}
                      >
                        Elimina
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mb-2 text-sm font-medium text-slate-700">
            {editingId ? "Modifica voce" : "Aggiungi voce"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <Label>Fornitore (opzionale)</Label>
              <Select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
                <option value="">Nessuno</option>
                {vendors.data?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Prezzo unitario (€)</Label>
              <Input type="number" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
            </div>
            <div>
              <Label>Unità (mq, cad, ml...)</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div>
              <Label>Quantità di riferimento</Label>
              <Input
                placeholder='es. "a corpo fino a 5mq"'
                value={form.referenceQuantity}
                onChange={(e) => setForm({ ...form, referenceQuantity: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <Label>Descrizione estesa / capitolato</Label>
              <Textarea value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} />
            </div>
            <label className="mt-6 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.includeInPreventivo}
                onChange={(e) => setForm({ ...form, includeInPreventivo: e.target.checked })}
              />
              Aggiungi a preventivo
            </label>
            <label className="mt-6 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.includeInBusinessPlan}
                onChange={(e) => setForm({ ...form, includeInBusinessPlan: e.target.checked })}
              />
              Aggiungi a business plan
            </label>
            <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3">
              <Button
                variant="secondary"
                disabled={!form.categoryId || !form.name || create.isPending || update.isPending}
                onClick={() => {
                  const data = {
                    categoryId: form.categoryId,
                    name: form.name,
                    unit: form.unit || undefined,
                    unitPrice: Number(form.unitPrice),
                    vendorId: form.vendorId || null,
                    specification: form.specification || undefined,
                    referenceQuantity: form.referenceQuantity || undefined,
                    includeInPreventivo: form.includeInPreventivo,
                    includeInBusinessPlan: form.includeInBusinessPlan,
                  };
                  if (editingId) {
                    update.mutate({ id: editingId, ...data });
                  } else {
                    create.mutate(data);
                  }
                }}
              >
                {editingId ? "Salva modifiche" : "Aggiungi voce"}
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
