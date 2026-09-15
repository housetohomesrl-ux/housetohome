import { useRef, useState } from "react";
import { trpc } from "../lib/trpc";
import { formatCurrency } from "../lib/format";
import { parseCsvWithHeader } from "../lib/csv";
import { costCategoryGroupSchema } from "@flipplan/shared";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

interface ImportRow {
  categoryGroup: "ACQUISIZIONE" | "MATERIALI" | "LAVORAZIONI" | "ENTI_ESTERNI" | "ALTRO";
  categoryName: string;
  name: string;
  unit?: string;
  unitPrice: number;
  notes?: string;
}

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; categoriesCreated: number; failed: { name: string; error: string }[] } | null>(null);

  const bulkImport = trpc.priceListItem.bulkImport.useMutation({
    onSuccess: (result) => {
      utils.priceListItem.list.invalidate();
      utils.costCategory.list.invalidate();
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
      </p>

      <Card className="mt-4">
        <CardHeader
          title="Importa da CSV"
          subtitle="Colonne richieste: group, category, name, unit, unitPrice, notes (le ultime due opzionali)."
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
            {importRows && (
              <span className="text-sm text-slate-600">
                {importRows.length} righe pronte da importare
              </span>
            )}
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
