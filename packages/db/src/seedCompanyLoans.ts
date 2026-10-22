import { prisma } from "./index.js";
import { MUTUO_FABRIZIO_CSV, PRESTITO_SRL_CSV } from "./companyLoanSeedData.js";

const SEED_LOANS = [
  { name: "Mutuo Fabrizio", csv: MUTUO_FABRIZIO_CSV },
  { name: "Prestito SRL", csv: PRESTITO_SRL_CSV },
];

function parsePayments(csv: string) {
  return csv
    .trim()
    .split("\n")
    .slice(1) // salta l'header
    .map((line) => {
      const [dueDate, principalPortion, interestPortion] = line.split(",");
      return {
        dueDate: new Date(dueDate!),
        principalPortion: Number(principalPortion),
        interestPortion: Number(interestPortion),
      };
    });
}

// Idempotente: crea i due finanziamenti aziendali reali (mutuo Fabrizio e
// prestito soci alla SRL) con il loro piano di ammortamento completo, per
// ogni tenant che non li abbia già — così i dati della banca, forniti una
// volta dall'utente, raggiungono il database di produzione al primo avvio
// dell'API dopo il deploy, senza bisogno di caricarli a mano nella UI.
export async function ensureSeedCompanyLoans() {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  for (const tenant of tenants) {
    for (const seed of SEED_LOANS) {
      const existing = await prisma.companyLoan.findFirst({
        where: { tenantId: tenant.id, name: seed.name },
      });
      if (existing) continue;
      const loan = await prisma.companyLoan.create({ data: { tenantId: tenant.id, name: seed.name } });
      await prisma.companyLoanPayment.createMany({
        data: parsePayments(seed.csv).map((p) => ({ ...p, companyLoanId: loan.id })),
      });
    }
  }
}
