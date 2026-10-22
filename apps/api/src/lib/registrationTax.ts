/**
 * Imposta di registro all'acquisto, pagata al notaio in aggiunta al suo
 * onorario. Regola decisa dal regime fiscale del deal:
 * - SOCIETA_CAPITALI (acquisto con la società): nessun beneficio prima casa,
 *   9% sempre sul prezzo di acquisto pieno.
 * - PERSONA_FISICA (acquisto da privato): 2% (prima casa) o 9% (seconda
 *   casa) sulla rendita catastale, non sul prezzo dichiarato.
 * - ALTRO o non impostato: nessun calcolo automatico.
 */
export function computeRegistrationTax(input: {
  regimeType: "SOCIETA_CAPITALI" | "PERSONA_FISICA" | "ALTRO" | null | undefined;
  purchaseCategory: "PRIMA_CASA" | "SECONDA_CASA" | null | undefined;
  purchasePrice: number;
  renditaCatastale: number | null | undefined;
}): number | null {
  if (input.regimeType === "SOCIETA_CAPITALI") {
    return input.purchasePrice * 0.09;
  }
  if (input.regimeType === "PERSONA_FISICA" && input.purchaseCategory) {
    const rendita = input.renditaCatastale ?? 0;
    return input.purchaseCategory === "PRIMA_CASA" ? rendita * 0.02 : rendita * 0.09;
  }
  return null;
}
