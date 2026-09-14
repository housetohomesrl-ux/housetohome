import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatCurrency } from "../../lib/format";
import type { DealDetail } from "../../lib/types";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Input, Label, Select } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";

const LOAN_TYPE_LABEL: Record<string, string> = {
  MUTUO_PONTE: "Mutuo/prestito ponte",
  PRESTITO_SOCI: "Prestito soci",
  ALTRO: "Altro",
};

const AMORTIZATION_LABEL: Record<string, string> = {
  INTEREST_ONLY: "Solo interessi (bullet)",
  FRENCH: "Ammortamento francese",
  MANUAL: "Piano manuale",
};

export default function FinancingTab({ deal }: { deal: DealDetail }) {
  const utils = trpc.useUtils();
  const invalidate = () => utils.deal.get.invalidate({ id: deal.id });

  const [loanForm, setLoanForm] = useState({
    name: "",
    type: "MUTUO_PONTE",
    principalAmount: "0",
    annualInterestRatePct: "6",
    durationMonths: "6",
    amortizationType: "INTEREST_ONLY",
  });
  const createLoan = trpc.loan.create.useMutation({
    onSuccess: () => {
      invalidate();
      setLoanForm({ name: "", type: "MUTUO_PONTE", principalAmount: "0", annualInterestRatePct: "6", durationMonths: "6", amortizationType: "INTEREST_ONLY" });
    },
  });
  const deleteLoan = trpc.loan.delete.useMutation({ onSuccess: invalidate });

  const [partnerForm, setPartnerForm] = useState({ name: "", contributionAmount: "0", profitSharePct: "100" });
  const createPartner = trpc.partner.create.useMutation({
    onSuccess: () => {
      invalidate();
      setPartnerForm({ name: "", contributionAmount: "0", profitSharePct: "100" });
    },
  });
  const deletePartner = trpc.partner.delete.useMutation({ onSuccess: invalidate });

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader title="Finanziamenti" subtitle="Mutui, prestiti ponte e prestiti soci con relativo piano di rimborso." />
        <CardBody>
          {deal.loans.length > 0 && (
            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                  <th className="py-2 pr-2">Nome</th>
                  <th className="py-2 pr-2">Tipo</th>
                  <th className="py-2 pr-2 text-right">Capitale</th>
                  <th className="py-2 pr-2 text-right">Tasso annuo</th>
                  <th className="py-2 pr-2 text-right">Durata</th>
                  <th className="py-2 pr-2">Piano</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {deal.loans.map((loan) => (
                  <tr key={loan.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2">{loan.name}</td>
                    <td className="py-2 pr-2 text-slate-500">{LOAN_TYPE_LABEL[loan.type]}</td>
                    <td className="py-2 pr-2 text-right">{formatCurrency(loan.principalAmount, true)}</td>
                    <td className="py-2 pr-2 text-right">{loan.annualInterestRatePct}%</td>
                    <td className="py-2 pr-2 text-right">{loan.durationMonths} mesi</td>
                    <td className="py-2 pr-2 text-slate-500">{AMORTIZATION_LABEL[loan.amortizationType]}</td>
                    <td className="py-2 pr-2 text-right">
                      <button className="text-xs text-red-500 hover:underline" onClick={() => deleteLoan.mutate({ id: loan.id })}>
                        Elimina
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <details className="rounded-md border border-dashed border-slate-300 p-3">
            <summary className="cursor-pointer text-sm font-medium text-brand-700">+ Aggiungi finanziamento</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label>Nome</Label>
                <Input value={loanForm.name} onChange={(e) => setLoanForm({ ...loanForm, name: e.target.value })} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={loanForm.type} onChange={(e) => setLoanForm({ ...loanForm, type: e.target.value })}>
                  {Object.entries(LOAN_TYPE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Piano di ammortamento</Label>
                <Select value={loanForm.amortizationType} onChange={(e) => setLoanForm({ ...loanForm, amortizationType: e.target.value })}>
                  {Object.entries(AMORTIZATION_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Capitale (€)</Label>
                <Input type="number" value={loanForm.principalAmount} onChange={(e) => setLoanForm({ ...loanForm, principalAmount: e.target.value })} />
              </div>
              <div>
                <Label>Tasso annuo (%)</Label>
                <Input type="number" value={loanForm.annualInterestRatePct} onChange={(e) => setLoanForm({ ...loanForm, annualInterestRatePct: e.target.value })} />
              </div>
              <div>
                <Label>Durata (mesi)</Label>
                <Input type="number" value={loanForm.durationMonths} onChange={(e) => setLoanForm({ ...loanForm, durationMonths: e.target.value })} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Button
                  variant="secondary"
                  disabled={!loanForm.name || createLoan.isPending}
                  onClick={() =>
                    createLoan.mutate({
                      dealId: deal.id,
                      name: loanForm.name,
                      type: loanForm.type as "MUTUO_PONTE" | "PRESTITO_SOCI" | "ALTRO",
                      principalAmount: Number(loanForm.principalAmount),
                      annualInterestRatePct: Number(loanForm.annualInterestRatePct),
                      durationMonths: Number(loanForm.durationMonths),
                      amortizationType: loanForm.amortizationType as "INTEREST_ONLY" | "FRENCH" | "MANUAL",
                    })
                  }
                >
                  Aggiungi finanziamento
                </Button>
              </div>
            </div>
          </details>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Capitale proprio e soci" subtitle="Equity investita e relativa quota di partecipazione agli utili." />
        <CardBody>
          {deal.partners.length > 0 && (
            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                  <th className="py-2 pr-2">Nome</th>
                  <th className="py-2 pr-2 text-right">Capitale conferito</th>
                  <th className="py-2 pr-2 text-right">Quota utili</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {deal.partners.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2">{p.name}</td>
                    <td className="py-2 pr-2 text-right">{formatCurrency(p.contributionAmount, true)}</td>
                    <td className="py-2 pr-2 text-right">{p.profitSharePct}%</td>
                    <td className="py-2 pr-2 text-right">
                      <button className="text-xs text-red-500 hover:underline" onClick={() => deletePartner.mutate({ id: p.id })}>
                        Elimina
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <details className="rounded-md border border-dashed border-slate-300 p-3">
            <summary className="cursor-pointer text-sm font-medium text-brand-700">+ Aggiungi socio/capitale proprio</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Nome</Label>
                <Input value={partnerForm.name} onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })} />
              </div>
              <div>
                <Label>Capitale conferito (€)</Label>
                <Input type="number" value={partnerForm.contributionAmount} onChange={(e) => setPartnerForm({ ...partnerForm, contributionAmount: e.target.value })} />
              </div>
              <div>
                <Label>Quota utili (%)</Label>
                <Input type="number" value={partnerForm.profitSharePct} onChange={(e) => setPartnerForm({ ...partnerForm, profitSharePct: e.target.value })} />
              </div>
              <div className="sm:col-span-3">
                <Button
                  variant="secondary"
                  disabled={!partnerForm.name || createPartner.isPending}
                  onClick={() =>
                    createPartner.mutate({
                      dealId: deal.id,
                      name: partnerForm.name,
                      contributionAmount: Number(partnerForm.contributionAmount),
                      profitSharePct: Number(partnerForm.profitSharePct),
                    })
                  }
                >
                  Aggiungi
                </Button>
              </div>
            </div>
          </details>
        </CardBody>
      </Card>
    </div>
  );
}
