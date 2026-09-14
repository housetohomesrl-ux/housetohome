// Seed DEMO — crea un tenant/utente/deal di esempio, chiaramente separato
// dai dati reali (isDemo=true sul deal). Da eseguire SOLO in locale/staging,
// MAI in produzione. Indirizzo ed importi sono fittizi.
import bcrypt from "bcryptjs";
import { prisma } from "./index.js";

async function main() {
  const existingDemoTenant = await prisma.tenant.findFirst({ where: { name: "Demo FlipPlan" } });
  if (existingDemoTenant) {
    console.log("Tenant demo già presente, nessuna azione.");
    return;
  }

  const tenant = await prisma.tenant.create({
    data: { name: "Demo FlipPlan", plan: "free" },
  });

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "demo@flipplan.local",
      passwordHash,
      name: "Utente Demo",
      role: "OWNER",
    },
  });

  const vendor = await prisma.vendor.create({
    data: {
      tenantId: tenant.id,
      name: "Impresa Edile Demo Srl",
      contact: "info@impresademo.it",
      specialty: "Ristrutturazioni chiavi in mano",
    },
  });

  const categories = await prisma.costCategory.findMany({ where: { tenantId: null } });
  const byName = (name: string) => {
    const cat = categories.find((c) => c.name === name);
    if (!cat) throw new Error(`Categoria di sistema mancante: ${name}. Esegui prima "pnpm db:seed".`);
    return cat;
  };

  const deal = await prisma.deal.create({
    data: {
      tenantId: tenant.id,
      createdById: user.id,
      name: "Appartamento Via Esempio 12 (demo)",
      address: "Via Esempio 12, Bologna (indirizzo fittizio)",
      propertyType: "Appartamento",
      status: "RISTRUTTURAZIONE",
      isDemo: true,
    },
  });

  await prisma.acquisitionDetails.create({
    data: { dealId: deal.id, purchasePrice: 145000, notes: "Acquisto da privato, asta esclusa." },
  });

  await prisma.fiscalSettings.create({
    data: {
      dealId: deal.id,
      regimeType: "PERSONA_FISICA",
      saleSubjectToVat: false,
      costsVatRecoverable: false,
      capitalGainsTaxRatePct: 26,
    },
  });

  await prisma.renovationSettings.create({
    data: { dealId: deal.id, contingencyPct: 12 },
  });

  await prisma.holdingCostsConfig.create({
    data: {
      dealId: deal.id,
      durationMonths: 7,
      monthlyInsurance: 40,
      monthlyUtilities: 60,
      monthlyPropertyTax: 90,
      monthlyCondoFees: 70,
    },
  });

  await prisma.loan.create({
    data: {
      dealId: deal.id,
      name: "Prestito ponte Banca Demo",
      type: "MUTUO_PONTE",
      principalAmount: 100000,
      annualInterestRatePct: 6.5,
      durationMonths: 7,
      amortizationType: "INTEREST_ONLY",
    },
  });

  await prisma.partner.create({
    data: {
      dealId: deal.id,
      name: "Utente Demo (capitale proprio)",
      contributionAmount: 70000,
      profitSharePct: 100,
      linkedUserId: user.id,
    },
  });

  const lineItems: Array<{
    category: string;
    description: string;
    taxableAmount: number;
    vatRatePct: number;
    paidAmount?: number;
    isMemo?: boolean;
    isUnbilled?: boolean;
  }> = [
    { category: "Spese notarili", description: "Notaio rogito", taxableAmount: 2200, vatRatePct: 22, paidAmount: 2200 },
    { category: "Imposta di registro / IVA acquisto", description: "Imposta di registro (9%)", taxableAmount: 13050, vatRatePct: 0, paidAmount: 13050 },
    { category: "Commissioni agenzia (acquisto)", description: "Provvigione agenzia acquisto", taxableAmount: 3500, vatRatePct: 22, paidAmount: 3500 },
    { category: "Lavorazioni edili", description: "Demolizioni e rifacimento tramezzi", taxableAmount: 8500, vatRatePct: 10 },
    { category: "Lavorazioni idrauliche", description: "Rifacimento impianto idraulico bagno + cucina", taxableAmount: 6200, vatRatePct: 10, paidAmount: 3000 },
    { category: "Lavorazioni elettriche", description: "Rifacimento impianto elettrico a norma", taxableAmount: 5400, vatRatePct: 10 },
    { category: "Pavimenti e rivestimenti", description: "Gres porcellanato 90 mq", taxableAmount: 4700, vatRatePct: 22 },
    { category: "Infissi e serramenti", description: "Serramenti PVC 6 finestre + portoncino", taxableAmount: 7200, vatRatePct: 22 },
    { category: "Sanitari e rubinetteria", description: "Sanitari e rubinetteria bagno", taxableAmount: 2100, vatRatePct: 22 },
    { category: "Tinteggiatura", description: "Tinteggiatura completa", taxableAmount: 1800, vatRatePct: 10 },
    { category: "Permessi edilizi", description: "CILA + oneri comunali", taxableAmount: 900, vatRatePct: 0, paidAmount: 900 },
    { category: "Progettazione / tecnico", description: "Onorario geometra/tecnico", taxableAmount: 2500, vatRatePct: 22 },
    { category: "Materiali edili", description: "Materiale fornito direttamente dall'impresa (già nel suo preventivo)", taxableAmount: 3000, vatRatePct: 22, isMemo: true },
    { category: "Varie ed eventuali", description: "Piccola manodopera extra pagata in contanti", taxableAmount: 400, vatRatePct: 0, paidAmount: 400, isUnbilled: true },
  ];

  for (const [index, item] of lineItems.entries()) {
    await prisma.costLineItem.create({
      data: {
        dealId: deal.id,
        categoryId: byName(item.category).id,
        description: item.description,
        taxableAmount: item.taxableAmount,
        vatRatePct: item.vatRatePct,
        paidAmount: item.paidAmount ?? 0,
        isMemo: item.isMemo ?? false,
        isUnbilled: item.isUnbilled ?? false,
        vendorId: item.category.startsWith("Lavorazioni") ? vendor.id : null,
        order: index,
      },
    });
  }

  await prisma.saleScenario.createMany({
    data: [
      { dealId: deal.id, scenario: "PRUDENTE", estimatedSalePrice: 220000, agencyFeesSellPct: 3, marketingStagingCosts: 1200, closingCosts: 500 },
      { dealId: deal.id, scenario: "REALISTICO", estimatedSalePrice: 235000, agencyFeesSellPct: 3, marketingStagingCosts: 1200, closingCosts: 500 },
      { dealId: deal.id, scenario: "OTTIMISTICO", estimatedSalePrice: 250000, agencyFeesSellPct: 3, marketingStagingCosts: 1200, closingCosts: 500 },
    ],
  });

  await prisma.note.create({
    data: {
      dealId: deal.id,
      text: "Imposta di registro da confermare con il notaio: potrebbe applicarsi l'aliquota agevolata.",
      severity: "AVVISO",
      createdById: user.id,
    },
  });

  console.log("Seed demo completato. Login: demo@flipplan.local / demo1234");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
