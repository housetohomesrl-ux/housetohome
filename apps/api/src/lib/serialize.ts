import { Prisma } from "@flipplan/db";

/** Tipo di supporto: rimpiazza ricorsivamente Prisma.Decimal con number nel tipo TS. */
export type Decimalize<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? T
    : T extends (infer U)[]
      ? Decimalize<U>[]
      : T extends object
        ? { [K in keyof T]: Decimalize<T[K]> }
        : T;

/**
 * Converte ricorsivamente ogni Prisma.Decimal presente nella risposta in un
 * number JS "piatto" (e riflette la stessa conversione anche a livello di
 * TIPO, tramite Decimalize<T>) prima che tRPC la serializzi in JSON. Senza
 * questo passaggio, JSON.stringify chiamerebbe Decimal.toJSON() restituendo
 * una STRINGA (es. "1234.50"), e il frontend riceverebbe stringhe al posto
 * di numeri per ogni importo/percentuale — con bug silenziosi in ogni
 * calcolo o formattazione lato client, non rilevabili dal type-checker.
 */
export function serializeDecimals<T>(value: T): Decimalize<T> {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber() as Decimalize<T>;
  }
  if (value instanceof Date) {
    return value as Decimalize<T>;
  }
  if (Array.isArray(value)) {
    return value.map((v) => serializeDecimals(v)) as Decimalize<T>;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serializeDecimals(val);
    }
    return result as Decimalize<T>;
  }
  return value as Decimalize<T>;
}
