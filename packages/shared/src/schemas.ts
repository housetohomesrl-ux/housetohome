import { z } from "zod";

// Schemi Zod condivisi tra frontend (react-hook-form) e backend (validazione
// input tRPC): stessa regola di validazione ovunque, un solo posto da tenere
// aggiornato.

export const dealStatusSchema = z.enum([
  "VALUTAZIONE",
  "ACQUISIZIONE",
  "RISTRUTTURAZIONE",
  "VENDITA",
  "CHIUSO",
  "ARCHIVIATO",
]);

export const costCategoryGroupSchema = z.enum(["ACQUISIZIONE", "MATERIALI", "LAVORAZIONI", "ENTI_ESTERNI", "ALTRO"]);

export const costLineItemStatusSchema = z.enum(["DA_FARE", "IN_CORSO", "COMPLETATO"]);

export const loanTypeSchema = z.enum(["MUTUO_PONTE", "PRESTITO_SOCI", "ALTRO"]);

export const amortizationTypeSchema = z.enum(["INTEREST_ONLY", "FRENCH", "MANUAL"]);

export const fiscalRegimeTypeSchema = z.enum(["SOCIETA_CAPITALI", "PERSONA_FISICA", "ALTRO"]);

export const saleScenarioTypeSchema = z.enum(["PRUDENTE", "REALISTICO", "OTTIMISTICO"]);

export const noteSeveritySchema = z.enum(["INFO", "AVVISO", "CRITICO"]);

export const userRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);

export const attachmentTypeSchema = z.enum(["LOGO", "QUOTE_FILE", "EXPORT_PDF", "EXPORT_DOCX", "OTHER"]);

export const businessPlanStatusSchema = z.enum(["BOZZA", "FINALE"]);

// --- Auth ------------------------------------------------------------------

export const registerSchema = z.object({
  companyName: z.string().min(1, "Il nome dell'azienda/tenant è obbligatorio"),
  name: z.string().min(1, "Il nome è obbligatorio"),
  email: z.string().email("Email non valida"),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
});

export const loginSchema = z.object({
  email: z.string().email("Email non valida"),
  password: z.string().min(1, "Password obbligatoria"),
});

// --- Deal --------------------------------------------------------------------

export const dealCreateSchema = z.object({
  name: z.string().min(1, "Il nome del deal è obbligatorio"),
  address: z.string().optional(),
  propertyType: z.string().optional(),
  status: dealStatusSchema.default("VALUTAZIONE"),
});

export const dealUpdateSchema = dealCreateSchema.partial().extend({
  id: z.string(),
});

export const acquisitionDetailsSchema = z.object({
  dealId: z.string(),
  purchasePrice: z.number().nonnegative(),
  notes: z.string().optional(),
});

export const fiscalSettingsSchema = z.object({
  dealId: z.string(),
  regimeType: fiscalRegimeTypeSchema,
  saleSubjectToVat: z.boolean(),
  costsVatRecoverable: z.boolean(),
  iresRatePct: z.number().min(0).max(100),
  irapRatePct: z.number().min(0).max(100),
  capitalGainsTaxRatePct: z.number().min(0).max(100),
  notes: z.string().optional(),
});

export const renovationSettingsSchema = z.object({
  dealId: z.string(),
  contingencyPct: z.number().min(0).max(100),
});

export const costLineItemCreateSchema = z.object({
  dealId: z.string(),
  categoryId: z.string(),
  description: z.string().min(1, "La descrizione è obbligatoria"),
  taxableAmount: z.number().nonnegative(),
  vatRatePct: z.number().min(0).max(100),
  paidAmount: z.number().nonnegative().default(0),
  status: costLineItemStatusSchema.default("DA_FARE"),
  isMemo: z.boolean().default(false),
  isUnbilled: z.boolean().default(false),
  vendorId: z.string().nullable().optional(),
  priceListItemId: z.string().nullable().optional(),
  notes: z.string().optional(),
  order: z.number().int().default(0),
});

export const costLineItemUpdateSchema = costLineItemCreateSchema.partial().extend({
  id: z.string(),
});

export const quoteCreateSchema = z.object({
  costLineItemId: z.string(),
  vendorId: z.string().nullable().optional(),
  amount: z.number().nonnegative(),
  fileUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const vendorCreateSchema = z.object({
  name: z.string().min(1),
  contact: z.string().optional(),
  specialty: z.string().optional(),
  notes: z.string().optional(),
});

export const priceListItemCreateSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1),
  unit: z.string().optional(),
  unitPrice: z.number().nonnegative(),
  notes: z.string().optional(),
});

export const costCategoryCreateSchema = z.object({
  group: costCategoryGroupSchema,
  name: z.string().min(1),
  order: z.number().int().default(0),
});

export const manualLoanPaymentSchema = z.object({
  month: z.number().int().min(1),
  principalPortion: z.number().nonnegative(),
  interestPortion: z.number().nonnegative(),
});

export const loanCreateSchema = z.object({
  dealId: z.string(),
  name: z.string().min(1),
  type: loanTypeSchema.default("MUTUO_PONTE"),
  principalAmount: z.number().nonnegative(),
  annualInterestRatePct: z.number().min(0).max(100),
  durationMonths: z.number().int().min(1),
  amortizationType: amortizationTypeSchema.default("INTEREST_ONLY"),
  manualPayments: z.array(manualLoanPaymentSchema).optional(),
});

export const loanUpdateSchema = loanCreateSchema.partial().extend({
  id: z.string(),
});

export const partnerCreateSchema = z.object({
  dealId: z.string(),
  name: z.string().min(1),
  contributionAmount: z.number().nonnegative(),
  profitSharePct: z.number().min(0).max(100),
  linkedUserId: z.string().nullable().optional(),
  notes: z.string().optional(),
});

export const partnerUpdateSchema = partnerCreateSchema.partial().extend({
  id: z.string(),
});

export const holdingCostsConfigSchema = z.object({
  dealId: z.string(),
  durationMonths: z.number().int().min(1),
  monthlyInsurance: z.number().nonnegative(),
  monthlyUtilities: z.number().nonnegative(),
  monthlyPropertyTax: z.number().nonnegative(),
  monthlyCondoFees: z.number().nonnegative(),
  otherMonthlyCosts: z.number().nonnegative(),
});

export const saleScenarioUpsertSchema = z.object({
  dealId: z.string(),
  scenario: saleScenarioTypeSchema,
  estimatedSalePrice: z.number().nonnegative(),
  vatRatePct: z.number().min(0).max(100),
  agencyFeesSellPct: z.number().min(0).max(100),
  marketingStagingCosts: z.number().nonnegative(),
  closingCosts: z.number().nonnegative(),
});

export const noteCreateSchema = z.object({
  dealId: z.string(),
  relatedEntityType: z.string().nullable().optional(),
  relatedEntityId: z.string().nullable().optional(),
  text: z.string().min(1),
  severity: noteSeveritySchema.default("INFO"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type DealCreateInput = z.infer<typeof dealCreateSchema>;
export type CostLineItemCreateInput = z.infer<typeof costLineItemCreateSchema>;
export type LoanCreateInput = z.infer<typeof loanCreateSchema>;
export type SaleScenarioUpsertInput = z.infer<typeof saleScenarioUpsertSchema>;
