import { Prisma } from "@flipplan/db";

export const dealInclude = {
  acquisitionDetails: true,
  fiscalSettings: true,
  renovationSettings: true,
  holdingCosts: true,
  costLineItems: { include: { category: true }, orderBy: { order: "asc" } },
  loans: { include: { manualPayments: true } },
  partners: true,
  saleScenarios: true,
  notes: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.DealInclude;

export type FullDeal = Prisma.DealGetPayload<{ include: typeof dealInclude }>;
