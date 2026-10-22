// Seed di SOLO dati di sistema (tenantId = null): categorie di costo di
// default e template di business plan di default. Sicuro da eseguire anche
// in produzione — non crea nessun tenant, utente o deal demo.
import { prisma } from "./index.js";
import { ensureDefaultCostCategories } from "./defaultCategories.js";

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
  await ensureDefaultCostCategories();

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
