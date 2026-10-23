/**
 * Categorie catastali italiane rilevanti per un flip immobiliare (gruppi A
 * e C: abitazioni, uffici, magazzini, garage, negozi). È la categoria
 * all'acquisto (quella sulla visura al rogito): se l'immobile viene poi
 * ristrutturato e cambia destinazione d'uso (es. magazzino -> abitazione),
 * l'imposta di registro all'acquisto resta comunque calcolata su questa.
 *
 * - isLuxury: A/1, A/8, A/9 non hanno mai diritto all'agevolazione prima
 *   casa sull'imposta di registro, per legge.
 * - imuMoltiplicatore: moltiplicatore da applicare alla rendita catastale
 *   rivalutata del 5% per stimare la base imponibile IMU.
 */
export interface CatastaleCategoryInfo {
  label: string;
  isLuxury: boolean;
  imuMoltiplicatore: number;
}

export const CATASTALE_CATEGORIES = {
  "A/1": { label: "A/1 - Abitazioni signorili (lusso)", isLuxury: true, imuMoltiplicatore: 160 },
  "A/2": { label: "A/2 - Abitazioni civili", isLuxury: false, imuMoltiplicatore: 160 },
  "A/3": { label: "A/3 - Abitazioni economiche", isLuxury: false, imuMoltiplicatore: 160 },
  "A/4": { label: "A/4 - Abitazioni popolari", isLuxury: false, imuMoltiplicatore: 160 },
  "A/5": { label: "A/5 - Abitazioni ultrapopolari", isLuxury: false, imuMoltiplicatore: 160 },
  "A/6": { label: "A/6 - Abitazioni rurali", isLuxury: false, imuMoltiplicatore: 160 },
  "A/7": { label: "A/7 - Villini", isLuxury: false, imuMoltiplicatore: 160 },
  "A/8": { label: "A/8 - Ville (lusso)", isLuxury: true, imuMoltiplicatore: 160 },
  "A/9": { label: "A/9 - Castelli e palazzi di pregio storico/artistico (lusso)", isLuxury: true, imuMoltiplicatore: 160 },
  "A/10": { label: "A/10 - Uffici e studi privati", isLuxury: false, imuMoltiplicatore: 80 },
  "A/11": { label: "A/11 - Abitazioni tipiche dei luoghi", isLuxury: false, imuMoltiplicatore: 160 },
  "C/1": { label: "C/1 - Negozi e botteghe", isLuxury: false, imuMoltiplicatore: 55 },
  "C/2": { label: "C/2 - Magazzini e locali di deposito", isLuxury: false, imuMoltiplicatore: 160 },
  "C/3": { label: "C/3 - Laboratori per arti e mestieri", isLuxury: false, imuMoltiplicatore: 140 },
  "C/4": { label: "C/4 - Fabbricati per esercizi sportivi", isLuxury: false, imuMoltiplicatore: 140 },
  "C/5": { label: "C/5 - Stabilimenti balneari e acque curative", isLuxury: false, imuMoltiplicatore: 140 },
  "C/6": { label: "C/6 - Stalle, scuderie, autorimesse/garage", isLuxury: false, imuMoltiplicatore: 160 },
  "C/7": { label: "C/7 - Tettoie chiuse o aperte", isLuxury: false, imuMoltiplicatore: 160 },
} as const satisfies Record<string, CatastaleCategoryInfo>;

export type CatastaleCategoryCode = keyof typeof CATASTALE_CATEGORIES;

export function isLuxuryCategory(code: string | null | undefined): boolean {
  if (!code) return false;
  return CATASTALE_CATEGORIES[code as CatastaleCategoryCode]?.isLuxury ?? false;
}

export function imuMoltiplicatore(code: string | null | undefined): number {
  if (!code) return 160; // default: la maggior parte delle abitazioni e dei garage/magazzini usa 160
  return CATASTALE_CATEGORIES[code as CatastaleCategoryCode]?.imuMoltiplicatore ?? 160;
}
