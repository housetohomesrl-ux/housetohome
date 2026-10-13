import type { BusinessPlanData } from "./types";

// Export del business plan in Excel (.xlsx), un foglio per sezione, con
// numeri veri (non testo) così che il file resti rielaborabile. exceljs è
// caricato solo al click, per non appesantire il bundle iniziale.

const EUR = '#,##0.00 "€"';
const PCT = "0.0%";

const GROUP_LABEL: Record<string, string> = {
  LAVORAZIONI: "Lavorazioni",
  MATERIALI: "Materiali",
  ENTI_ESTERNI: "Enti esterni",
  ALTRO: "Altro",
};

export interface BusinessPlanRisk {
  level: string;
  text: string;
}

export function businessPlanFileName(dealName: string, extension: string): string {
  const safe = dealName.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();
  return `Business plan - ${safe}.${extension}`;
}

export async function exportBusinessPlanXlsx(data: BusinessPlanData, risks: BusinessPlanRisk[], scenarioLabel: string) {
  const plan = data.plan;
  if (!plan) return;
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "FlipPlan";
  wb.created = new Date();
  const { kpis, financials: f, cashFlow } = plan;

  type Cell = string | number | null;
  const addSheet = (name: string, header: string[], rows: Cell[][], formats: Array<string | undefined>, widths: number[]) => {
    const ws = wb.addWorksheet(name);
    ws.columns = header.map((h, i) => ({ header: h, width: widths[i] ?? 16, style: formats[i] ? { numFmt: formats[i] } : {} }));
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    rows.forEach((r) => ws.addRow(r));
    return ws;
  };

  // Sintesi: valori con formato per riga (importo o percentuale)
  const summary: Array<[string, Cell, "eur" | "pct" | "txt"]> = [
    ["Operazione", data.deal.name, "txt"],
    ["Indirizzo", data.deal.address ?? "", "txt"],
    ["Tipologia", data.deal.propertyType ?? "", "txt"],
    ["Scenario di vendita base", scenarioLabel, "txt"],
    ["Durata (mesi)", kpis.durationMonths, "txt"],
    ["Prezzo di acquisto", data.deal.purchasePrice, "eur"],
    ["Prezzo di vendita", kpis.salePrice, "eur"],
    ["Costo totale operazione", kpis.totalProjectCost, "eur"],
    ["Margine lordo", kpis.grossMargin, "eur"],
    ["Imposte stimate", kpis.taxes, "eur"],
    ["Margine netto", kpis.netMargin, "eur"],
    ["Capitale proprio", kpis.equityInvested, "eur"],
    ["Fabbisogno massimo di cassa", cashFlow.peakFundingNeed, "eur"],
    ["Capitale richiesto", Math.max(cashFlow.peakFundingNeed, kpis.equityInvested), "eur"],
    ["ROI", kpis.roi, "pct"],
    ["ROE", kpis.roe, "pct"],
    ["Margine sul prezzo di vendita", kpis.marginOnRevenue, "pct"],
    ["Rendimento annualizzato", kpis.annualizedRoi, "pct"],
    ["ROE annualizzato", kpis.annualizedRoe, "pct"],
    ["Prezzo di pareggio", f.kpis.breakevenSalePrice, "eur"],
  ];
  const ws1 = addSheet("Sintesi", ["Voce", "Valore"], summary.map(([l, v]) => [l, v]), [], [34, 22]);
  summary.forEach(([, , fmt], i) => {
    if (fmt !== "txt") ws1.getCell(i + 2, 2).numFmt = fmt === "eur" ? EUR : PCT;
  });

  addSheet(
    "Conto economico",
    ["Voce", "Importo"],
    [
      ["Ricavo di vendita", kpis.salePrice],
      ["Costi di vendita", -kpis.saleCosts],
      ["Acquisizione", -f.totals.totalAcquisitionCost],
      ["Lavori (imprevisti inclusi)", -f.totals.totalRenovationCost],
      ["Enti esterni", -f.totals.totalEntiEsterniCost],
      ["Altro", -f.totals.totalAltroCost],
      ["Detenzione (costi fissi)", -f.holding.nonLoanTotal],
      ["Oneri finanziari", -f.holding.loanInterestTotal],
      ["Margine lordo", kpis.grossMargin],
      ["Imposte stimate", -kpis.taxes],
      ["Margine netto", kpis.netMargin],
    ],
    [undefined, EUR],
    [34, 18],
  );

  addSheet(
    "Acquisizione",
    ["Voce", "Imponibile", "IVA %"],
    [["Prezzo di acquisto", data.deal.purchasePrice, 0], ...data.acquisitionLines.map((l) => [l.description, l.taxableAmount, l.vatRatePct / 100])],
    [undefined, EUR, PCT],
    [40, 16, 10],
  );

  const p = data.preventivo;
  addSheet(
    "Piano lavori",
    ["Gruppo", "Categoria", "Voci", "Imponibile", "IVA", "Totale"],
    [
      ...p.categories.map((c) => [GROUP_LABEL[c.group] ?? c.group, c.categoryName, c.lineCount, c.taxable, c.vat, c.total]),
      ["Imprevisti", `${p.contingencyPct}% su lavorazioni e materiali`, null, p.contingencyAmount, 0, p.contingencyAmount],
      ["Totale lavori", "", p.lineCount, p.taxable + p.contingencyAmount, p.vat, p.total],
      [],
      ...p.highlightedLines.map((l) => ["Voce principale", l.description, null, l.taxable, l.total - l.taxable, l.total]),
      ...p.toQuoteLines.map((l) => ["DA QUOTARE", `${l.categoryName} · ${l.description}`, null, null, null, null]),
    ],
    [undefined, undefined, undefined, EUR, EUR, EUR],
    [16, 44, 8, 16, 14, 16],
  );

  addSheet(
    "Finanziamento",
    ["Tipo", "Nome", "Importo", "Tasso / quota utili", "Durata (mesi)"],
    [
      ...data.partners.map((x) => ["Capitale proprio", x.name, x.contributionAmount, x.profitSharePct / 100, null]),
      ...data.loans.map((l) => ["Finanziamento", l.name, l.principalAmount, l.annualInterestRatePct / 100, l.durationMonths]),
    ],
    [undefined, undefined, EUR, "0.00%", undefined],
    [18, 36, 16, 18, 14],
  );

  addSheet(
    "Cash flow",
    ["Mese", "Acquisto", "Lavori", "Detenzione", "Finanziamenti erogati", "Interessi", "Rimborso capitale", "Vendita netta", "Imposte", "Netto", "Cumulato"],
    cashFlow.months.map((m) => [
      m.month,
      -m.acquisition,
      -m.renovation,
      -m.holding,
      m.loanDisbursement,
      -m.loanInterest,
      -m.loanPrincipal,
      m.saleNet,
      -m.taxes,
      m.net,
      m.cumulative,
    ]),
    [undefined, EUR, EUR, EUR, EUR, EUR, EUR, EUR, EUR, EUR, EUR],
    [8, 14, 14, 14, 18, 12, 16, 16, 14, 14, 14],
  );

  const ws7 = addSheet(
    "Scenari",
    ["Scenario", "Var. prezzo", "Sforamento lavori", "Ritardo (mesi)", "Prezzo di vendita", "Costo totale", "Margine netto", "ROI", "ROE", "Durata (mesi)", "Rendimento annualizzato"],
    plan.scenarios.map((s) => [
      s.label,
      s.salePriceDeltaPct,
      s.renovationOverrunPct,
      s.delayMonths,
      s.kpis.salePrice,
      s.kpis.totalProjectCost,
      s.kpis.netMargin,
      s.kpis.roi,
      s.kpis.roe,
      s.kpis.durationMonths,
      s.kpis.annualizedRoi,
    ]),
    [undefined, PCT, PCT, undefined, EUR, EUR, EUR, PCT, PCT, undefined, PCT],
    [16, 12, 16, 14, 18, 16, 16, 10, 10, 14, 20],
  );
  ws7.addRow([]);
  ws7.addRow(["Una variabile alla volta", null, null, null, null, null, "Margine netto", "ROI", "Scostamento"]).font = { bold: true };
  for (const t of plan.stressTests) {
    const row = ws7.addRow([t.label, null, null, null, null, null, t.netMargin, t.roi, t.deltaVsBase]);
    row.getCell(9).numFmt = EUR;
  }

  addSheet("Rischi", ["Livello", "Punto di attenzione"], risks.map((r) => [r.level, r.text]), [], [12, 110]);

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    businessPlanFileName(data.deal.name, "xlsx"),
  );
}

/** PDF tramite la stampa del browser: il titolo della pagina diventa il nome del file proposto. */
export function exportBusinessPlanPdf(dealName: string) {
  const previousTitle = document.title;
  document.title = businessPlanFileName(dealName, "pdf").replace(/\.pdf$/, "");
  const restore = () => {
    document.title = previousTitle;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
