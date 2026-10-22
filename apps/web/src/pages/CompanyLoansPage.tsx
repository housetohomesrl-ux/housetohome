import { useRef, useState } from "react";
import { trpc } from "../lib/trpc";
import { formatCurrency } from "../lib/format";
import { parseCsvWithHeader } from "../lib/csv";
import { formatDateIt } from "./deal/PreventivoTab";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Input, Label } from "../components/ui/Field";
import { Button } from "../components/ui/Button";

/**
 * Finanziamenti aziendali sempre attivi (mutuo, prestito soci...), non
 * legati a un deal specifico: si importa una volta sola il piano di
 * ammortamento REALE della banca (data + quota capitale + quota interessi
 * di ogni rata), e l'app calcola in automatico la rata (capitale +
 * interessi, non solo gli interessi: è un costo fisso che l'azienda paga
 * comunque ogni mese) da attribuire a un flip in base alla sua "Data di
 * acquisto" (scheda Acquisizione) e alla durata cantiere.
 */
export default function CompanyLoansPage() {
  const utils = trpc.useUtils();
  const loans = trpc.companyLoan.list.useQuery();
  const [name, setName] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRefs = useRef(new Map<string, HTMLInputElement>());

  const create = trpc.companyLoan.create.useMutation({
    onSuccess: () => {
      utils.companyLoan.list.invalidate();
      setName("");
    },
  });
  const remove = trpc.companyLoan.delete.useMutation({ onSuccess: () => utils.companyLoan.list.invalidate() });
  const bulkImport = trpc.companyLoan.bulkImportPayments.useMutation({
    onSuccess: () => {
      utils.companyLoan.list.invalidate();
      setImportError(null);
    },
    onError: (err) => setImportError(err.message),
  });

  function handleFile(loanId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const rows = parseCsvWithHeader(text);
        const payments = rows.map((r, i) => {
          const dueDate = new Date(r.dueDate ?? "");
          if (Number.isNaN(dueDate.getTime())) throw new Error(`Riga ${i + 2}: data "${r.dueDate}" non valida (usa formato AAAA-MM-GG)`);
          const principalPortion = Number(r.principalPortion);
          const interestPortion = Number(r.interestPortion);
          if (Number.isNaN(principalPortion) || Number.isNaN(interestPortion)) {
            throw new Error(`Riga ${i + 2}: quota capitale/interessi non numerica`);
          }
          return { dueDate, principalPortion, interestPortion };
        });
        bulkImport.mutate({ companyLoanId: loanId, payments });
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "File non leggibile");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Finanziamenti aziendali</h1>
      <p className="mt-1 text-sm text-slate-500">
        Mutui e prestiti sempre attivi (non legati a un singolo flip), con il piano di ammortamento reale della
        banca. In ogni flip, impostando la "Data di acquisto" (scheda Acquisizione), la rata (capitale + interessi)
        di questi finanziamenti nella finestra di durata del cantiere viene sommata in automatico ai costi di
        detenzione.
      </p>

      <Card className="mt-4">
        <CardHeader title="Nuovo finanziamento" />
        <CardBody className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="loanName">Nome</Label>
            <Input id="loanName" placeholder='es. "Mutuo Fabrizio"' value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button variant="secondary" disabled={!name.trim() || create.isPending} onClick={() => create.mutate({ name: name.trim() })}>
            Crea
          </Button>
        </CardBody>
      </Card>

      {importError && <p className="mt-3 text-sm text-red-600">{importError}</p>}

      <div className="mt-4 grid gap-4">
        {(loans.data ?? []).map((loan) => {
          const totalPrincipal = loan.payments.reduce((s, p) => s + p.principalPortion, 0);
          const totalInterest = loan.payments.reduce((s, p) => s + p.interestPortion, 0);
          const first = loan.payments[0];
          const last = loan.payments[loan.payments.length - 1];
          return (
            <Card key={loan.id}>
              <CardHeader
                title={loan.name}
                subtitle={
                  loan.payments.length > 0
                    ? `${loan.payments.length} rate importate, dal ${formatDateIt(first!.dueDate)} al ${formatDateIt(last!.dueDate)}`
                    : "Nessuna rata importata ancora."
                }
              />
              <CardBody className="flex flex-wrap items-center gap-3">
                <input
                  ref={(el) => {
                    if (el) fileInputRefs.current.set(loan.id, el);
                    else fileInputRefs.current.delete(loan.id);
                  }}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleFile(loan.id, e)}
                />
                <Button variant="secondary" onClick={() => fileInputRefs.current.get(loan.id)?.click()} disabled={bulkImport.isPending}>
                  {loan.payments.length > 0 ? "Ricarica piano (CSV)" : "Carica piano (CSV)"}
                </Button>
                {loan.payments.length > 0 && (
                  <span className="text-sm text-slate-500">
                    Capitale: {formatCurrency(totalPrincipal, true)} · Interessi: {formatCurrency(totalInterest, true)}
                  </span>
                )}
                <button className="ml-auto text-xs text-red-500 hover:underline" onClick={() => remove.mutate({ id: loan.id })}>
                  Elimina finanziamento
                </button>
              </CardBody>
            </Card>
          );
        })}
        {(loans.data ?? []).length === 0 && <p className="text-sm text-slate-400">Nessun finanziamento aziendale ancora.</p>}
      </div>
    </div>
  );
}
