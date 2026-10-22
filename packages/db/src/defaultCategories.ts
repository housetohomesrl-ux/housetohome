import { prisma, CostCategoryGroup } from "./index.js";

export const DEFAULT_CATEGORIES: Array<{ group: CostCategoryGroup; name: string; order: number }> = [
  { group: "ACQUISIZIONE", name: "Spese notarili", order: 1 },
  { group: "ACQUISIZIONE", name: "Imposta di registro / IVA acquisto", order: 2 },
  { group: "ACQUISIZIONE", name: "Agenzia", order: 3 },
  { group: "ACQUISIZIONE", name: "Due diligence / perizia", order: 4 },
  { group: "ACQUISIZIONE", name: "Notaio", order: 5 },
  { group: "ACQUISIZIONE", name: "Geometra", order: 6 },
  { group: "ACQUISIZIONE", name: "Ingegnere", order: 7 },
  { group: "ACQUISIZIONE", name: "Costi comunali", order: 8 },
  { group: "ACQUISIZIONE", name: "Costi per mutuo", order: 9 },
  { group: "MATERIALI", name: "Materiali edili", order: 10 },
  { group: "MATERIALI", name: "Sanitari e rubinetteria", order: 11 },
  { group: "MATERIALI", name: "Pavimenti e rivestimenti", order: 12 },
  { group: "MATERIALI", name: "Infissi e serramenti", order: 13 },
  { group: "LAVORAZIONI", name: "Lavorazioni edili", order: 20 },
  { group: "LAVORAZIONI", name: "Lavorazioni idrauliche", order: 21 },
  { group: "LAVORAZIONI", name: "Lavorazioni elettriche", order: 22 },
  { group: "LAVORAZIONI", name: "Tinteggiatura", order: 23 },
  { group: "LAVORAZIONI", name: "Demolizioni", order: 24 },
  { group: "ENTI_ESTERNI", name: "Permessi edilizi", order: 30 },
  { group: "ENTI_ESTERNI", name: "Progettazione / tecnico", order: 31 },
  { group: "ENTI_ESTERNI", name: "Allacci utenze", order: 32 },
  { group: "ENTI_ESTERNI", name: "Geometra", order: 33 },
  { group: "ENTI_ESTERNI", name: "Spese comunali", order: 34 },
  // Elettricista che rilascia SOLO le certificazioni (dichiarazione di
  // conformità), distinto dall'elettricista di LAVORAZIONI che esegue i
  // lavori — spesso non è lo stesso fornitore.
  { group: "ENTI_ESTERNI", name: "Elettricista (certificazioni)", order: 35 },
  // Spostamento/aggiunta/rimozione contatore: quasi obbligatorio in caso di
  // frazionamento di un immobile in più unità.
  { group: "ENTI_ESTERNI", name: "Hera (gas)", order: 36 },
  { group: "ENTI_ESTERNI", name: "Enel (contatore luce)", order: 37 },
  { group: "ALTRO", name: "Varie ed eventuali", order: 90 },
];

// Idempotente: crea solo le categorie di sistema (tenantId=null) mancanti,
// senza toccare quelle già presenti. Sicuro da chiamare ripetutamente (ogni
// avvio dell'API), così le nuove categorie di default raggiungono anche il
// database di produzione senza bisogno di lanciare il seed a mano.
export async function ensureDefaultCostCategories() {
  for (const category of DEFAULT_CATEGORIES) {
    const existing = await prisma.costCategory.findFirst({
      where: { tenantId: null, name: category.name },
    });
    if (!existing) {
      await prisma.costCategory.create({ data: { ...category, tenantId: null } });
    }
  }
}
