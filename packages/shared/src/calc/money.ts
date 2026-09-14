import Decimal from "decimal.js";

// Tutta l'aritmetica monetaria interna al motore di calcolo usa Decimal.js
// per evitare errori di arrotondamento in virgola mobile quando si sommano
// molte righe di costo. I confini pubblici (funzioni esportate da questo
// pacchetto) restituiscono sempre `number` arrotondati a 2 decimali (denaro)
// o 4 decimali (percentuali/rapporti), pronti per essere mostrati in UI.
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type Money = Decimal;

export const money = (value: number | string | Decimal): Decimal => new Decimal(value);

export const ZERO = new Decimal(0);

export const sumMoney = (values: Array<number | string | Decimal>): Decimal =>
  values.reduce<Decimal>((acc, v) => acc.plus(v), new Decimal(0));

/** Arrotonda a 2 decimali e converte in number, per l'output pubblico. */
export const toMoneyNumber = (value: Decimal): number => value.toDecimalPlaces(2).toNumber();

/** Arrotonda a 4 decimali (percentuali/rapporti come ROI) e converte in number. */
export const toRatioNumber = (value: Decimal): number => value.toDecimalPlaces(4).toNumber();

export const pctOf = (base: Decimal, pct: number | string | Decimal): Decimal =>
  base.times(pct).dividedBy(100);
