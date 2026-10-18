export const FLIP_STATUS_LABEL: Record<string, string> = {
  VALUTAZIONE: "In valutazione",
  ACQUISIZIONE: "Acquistato",
  RISTRUTTURAZIONE: "In ristrutturazione",
  VENDITA: "In vendita",
  CHIUSO: "Chiuso",
  ARCHIVIATO: "Archiviato",
};

// I deal "Ristrutturazione per un cliente" non passano da acquisto/vendita:
// riusano lo stesso DealStatus ma con un vocabolario dedicato.
export const CLIENT_STATUS_LABEL: Record<string, string> = {
  VALUTAZIONE: "Preventivo per cliente",
  ACQUISIZIONE: "Preventivo confermato",
  RISTRUTTURAZIONE: "Lavori in corso",
  CHIUSO: "Concluso",
  ARCHIVIATO: "Archiviato",
};
