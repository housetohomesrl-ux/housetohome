const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const currencyFormatterPrecise = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("it-IT", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatCurrency(value: number, precise = false): string {
  return (precise ? currencyFormatterPrecise : currencyFormatter).format(value);
}

/** value è una frazione (es. 0.185 => "18,5%"), coerente con i ratio del motore di calcolo. */
export function formatPercent(value: number): string {
  return percentFormatter.format(value);
}

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value));
}
