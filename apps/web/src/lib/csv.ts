/**
 * Parser CSV minimale (RFC 4180): virgola come separatore, campi tra
 * doppi apici per contenere virgole/newline, "" per l'apice letterale.
 * Sufficiente per import di piccoli file (listini prezzi) senza dipendenze esterne.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export function parseCsvWithHeader(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0]!.map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()));
    return obj;
  });
}

/** Serializza un valore come cella CSV (RFC 4180): tra apici solo se contiene virgola/apice/newline. */
function toCsvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Costruisce un CSV (con header) da righe di oggetti, nell'ordine delle colonne indicato. */
export function buildCsv(columns: string[], rows: Record<string, string | number | null | undefined>[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => toCsvCell(row[c])).join(","));
  }
  return lines.join("\r\n");
}

/** Avvia il download di un file di testo (CSV) nel browser. */
export function downloadTextFile(filename: string, content: string, mimeType = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
