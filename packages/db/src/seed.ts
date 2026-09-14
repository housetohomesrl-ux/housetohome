// Seed di SOLO dati di sistema (tenantId = null): categorie di costo di
// default e template di business plan di default. Sicuro da eseguire anche
// in produzione — non crea nessun tenant, utente o deal demo.
import { prisma, CostCategoryGroup } from "./index.js";

const DEFAULT_CATEGORIES: Array<{ group: CostCategoryGroup; name: string; order: number }> = [
  { group: "ACQUISIZIONE", name: "Spese notarili", order: 1 },
  { group: "ACQUISIZIONE", name: "Imposta di registro / IVA acquisto", order: 2 },
  { group: "ACQUISIZIONE", name: "Commissioni agenzia (acquisto)", order: 3 },
  { group: "ACQUISIZIONE", name: "Due diligence / perizia", order: 4 },
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
  { group: "ALTRO", name: "Varie ed eventuali", order: 90 },
];

const DEFAULT_TEMPLATES = [
  {
    name: "Classico",
    isDefault: true,
    layoutConfig: {
      font: "serif",
      accentColor: "#1E3A8A",
      sectionOrder: [
        "executiveSummary",
        "propertyAndStrategy",
        "costPlan",
        "financialPlan",
        "riskAnalysis",
        "timeline",
        "investorProfile",
      ],
    },
  },
  {
    name: "Moderno",
    isDefault: false,
    layoutConfig: {
      font: "sans",
      accentColor: "#0F766E",
      sectionOrder: [
        "executiveSummary",
        "financialPlan",
        "costPlan",
        "propertyAndStrategy",
        "riskAnalysis",
        "timeline",
        "investorProfile",
      ],
    },
  },
];

async function main() {
  for (const category of DEFAULT_CATEGORIES) {
    const existing = await prisma.costCategory.findFirst({
      where: { tenantId: null, name: category.name },
    });
    if (!existing) {
      await prisma.costCategory.create({ data: { ...category, tenantId: null } });
    }
  }

  for (const template of DEFAULT_TEMPLATES) {
    const existing = await prisma.businessPlanTemplate.findFirst({
      where: { tenantId: null, name: template.name },
    });
    if (!existing) {
      await prisma.businessPlanTemplate.create({ data: { ...template, tenantId: null } });
    }
  }

  console.log("Seed di sistema completato.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
