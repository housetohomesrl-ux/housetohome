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

export const dealOperationTypeSchema = z.enum(["FLIP", "RISTRUTTURAZIONE_CLIENTE"]);

export const quoteStatusSchema = z.enum(["BOZZA", "INVIATO", "ACCETTATO", "RIFIUTATO"]);

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
  comune: z.string().optional(),
  propertyType: z.string().optional(),
  surfaceSqm: z.number().nonnegative().optional(),
  operationType: dealOperationTypeSchema.default("FLIP"),
  clientName: z.string().optional(),
  clientAddress: z.string().optional(),
  clientTaxCode: z.string().optional(),
  clientVatNumber: z.string().optional(),
  clientPhone: z.string().optional(),
  clientEmail: z.string().optional(),
  quoteDate: z.coerce.date().optional(),
  quoteValidUntil: z.coerce.date().optional(),
  quoteStatus: quoteStatusSchema.optional(),
  clientAmountReceived: z.number().nonnegative().optional(),
  clientAcconto1Pct: z.number().min(0).max(100).nullable().optional(),
  clientAcconto1Amount: z.number().nonnegative().optional(),
  clientAcconto1DueDate: z.coerce.date().nullable().optional(),
  clientAcconto2Pct: z.number().min(0).max(100).nullable().optional(),
  clientAcconto2Amount: z.number().nonnegative().optional(),
  clientAcconto2DueDate: z.coerce.date().nullable().optional(),
  clientAcconto3Pct: z.number().min(0).max(100).nullable().optional(),
  clientAcconto3Amount: z.number().nonnegative().optional(),
  clientAcconto3DueDate: z.coerce.date().nullable().optional(),
  clientSaldoAmount: z.number().nonnegative().optional(),
  clientSaldoDueDate: z.coerce.date().nullable().optional(),
  status: dealStatusSchema.default("VALUTAZIONE"),
});

export const dealUpdateSchema = dealCreateSchema.partial().extend({
  id: z.string(),
});

export const purchaseCategorySchema = z.enum(["PRIMA_CASA", "SECONDA_CASA"]);

export const acquisitionDetailsSchema = z.object({
  dealId: z.string(),
  purchasePrice: z.number().nonnegative(),
  depositAmount: z.number().nonnegative().optional(),
  purchaseDate: z.coerce.date().nullable().optional(),
  purchaseCategory: purchaseCategorySchema.nullable().optional(),
  renditaCatastale: z.number().nonnegative().nullable().optional(),
  imuRatePct: z.number().nonnegative().nullable().optional(),
  categoriaCatastale: z.string().nullable().optional(),
  ownStakePct: z.number().min(0).max(100).optional(),
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
  materialMarkupPct: z.number().min(0).max(1000).optional(),
  laborMarkupPct: z.number().min(0).max(1000).optional(),
  quoteVatRatePct: z.number().min(0).max(100).optional(),
  unifyMaterialPricesInQuote: z.boolean().optional(),
});

export const costLineItemCreateSchema = z.object({
  dealId: z.string(),
  categoryId: z.string(),
  description: z.string().min(1, "La descrizione è obbligatoria"),
  quantity: z.number().nonnegative().nullable().optional(),
  unit: z.string().nullable().optional(),
  taxableAmount: z.number().nonnegative(),
  vatRatePct: z.number().min(0).max(100),
  nonTaxableAmount: z.number().nonnegative().default(0),
  clientPrice: z.number().nonnegative().nullable().optional(),
  paidAmount: z.number().nonnegative().default(0),
  status: costLineItemStatusSchema.default("DA_FARE"),
  isMemo: z.boolean().default(false),
  isUnbilled: z.boolean().default(false),
  vendorId: z.string().nullable().optional(),
  priceListItemId: z.string().nullable().optional(),
  notes: z.string().optional(),
  targetCategoriaCatastale: z.string().nullable().optional(),
  order: z.number().int().default(0),
});

export const costLineItemUpdateSchema = costLineItemCreateSchema.partial().extend({
  id: z.string(),
});

// Import in blocco di voci di costo direttamente in un deal (preventivo
// fornitore caricato dall'utente), senza passare dalla libreria prezzi.
export const costLineItemBulkImportSchema = z.object({
  dealId: z.string(),
  items: z
    .array(
      z.object({
        categoryGroup: costCategoryGroupSchema,
        categoryName: z.string().min(1),
        description: z.string().min(1),
        quantity: z.number().nonnegative().optional(),
        unit: z.string().optional(),
        taxableAmount: z.number().nonnegative(),
        vatRatePct: z.number().min(0).max(100).optional(),
        nonTaxableAmount: z.number().nonnegative().optional(),
        vendorName: z.string().optional(),
        clientPrice: z.number().nonnegative().optional(),
        notes: z.string().optional(),
      }),
    )
    .min(1)
    .max(500),
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
  email: z.string().optional(),
  specialty: z.string().optional(),
  notes: z.string().optional(),
});

export const clientCreateSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  taxCode: z.string().optional(),
  vatNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

// Usato per memorizzare in automatico i "Dati cliente" di un deal
// nell'agenda clienti: trova per nome (case-insensitive) e aggiorna, o crea.
export const clientUpsertByNameSchema = clientCreateSchema;

export const priceListItemCreateSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1),
  unit: z.string().optional(),
  unitPrice: z.number().nonnegative(),
  vendorId: z.string().nullable().optional(),
  specification: z.string().optional(),
  referenceQuantity: z.string().optional(),
  notes: z.string().optional(),
  includeInPreventivo: z.boolean().optional(),
  includeInBusinessPlan: z.boolean().optional(),
  libraryScope: dealOperationTypeSchema.optional(),
});

export const priceListBulkImportSchema = z.object({
  items: z
    .array(
      z.object({
        categoryGroup: costCategoryGroupSchema,
        categoryName: z.string().min(1),
        name: z.string().min(1),
        unit: z.string().optional(),
        unitPrice: z.number().nonnegative(),
        vendorName: z.string().optional(),
        specification: z.string().optional(),
        referenceQuantity: z.string().optional(),
        notes: z.string().optional(),
        includeInPreventivo: z.boolean().optional(),
        includeInBusinessPlan: z.boolean().optional(),
        libraryScope: dealOperationTypeSchema.optional(),
      }),
    )
    .min(1)
    .max(1000),
});

// Pacchetto riutilizzabile di voci della libreria prezzi (es. "Bagno
// standard"): si salva una selezione fatta nel selettore multiplo e la si
// riapplica con un click ai deal successivi dello stesso tipo.
export const costTemplateCreateSchema = z.object({
  name: z.string().min(1),
  libraryScope: dealOperationTypeSchema,
  items: z
    .array(z.object({ priceListItemId: z.string(), quantity: z.number().positive() }))
    .min(1)
    .max(200),
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
  agencyFeesSellFixed: z.number().nonnegative().optional(),
  agencyFeesSellVatRatePct: z.number().min(0).max(100).optional(),
  marketingStagingCosts: z.number().nonnegative(),
  closingCosts: z.number().nonnegative(),
});

export const dealVendorPaymentSchema = z.object({
  dealId: z.string(),
  vendorId: z.string(),
  acconto1Pct: z.number().min(0).max(100).nullable().optional(),
  acconto1Amount: z.number().nonnegative().optional(),
  acconto2Pct: z.number().min(0).max(100).nullable().optional(),
  acconto2Amount: z.number().nonnegative().optional(),
  acconto3Pct: z.number().min(0).max(100).nullable().optional(),
  acconto3Amount: z.number().nonnegative().optional(),
  saldoAmount: z.number().nonnegative().optional(),
});

// Storico versioni del preventivo cliente: uno snapshot congelato delle
// voci/totale/IVA al momento della stampa/download, per confrontare cosa è
// stato proposto al cliente nel tempo.
export const quoteSnapshotCreateSchema = z.object({
  dealId: z.string(),
  grandTotal: z.number().nonnegative(),
  vatRatePct: z.number().min(0).max(100),
  items: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number().nullable().optional(),
        unit: z.string().nullable().optional(),
        price: z.number(),
        // Costo (imponibile + non imponibile, senza IVA) della voce al momento
        // dello snapshot: serve per ricostruire il margine stimato di allora
        // e confrontarlo col margine reale a consuntivo. Opzionale per
        // compatibilità con snapshot salvati prima che questo campo esistesse.
        cost: z.number().optional(),
      }),
    )
    .min(0)
    .max(500),
});

export const noteCreateSchema = z.object({
  dealId: z.string(),
  relatedEntityType: z.string().nullable().optional(),
  relatedEntityId: z.string().nullable().optional(),
  text: z.string().min(1),
  severity: noteSeveritySchema.default("INFO"),
});

export const sendQuoteEmailSchema = z.object({
  dealId: z.string(),
  pdfBase64: z.string().min(1),
});

export const sendVendorContractEmailSchema = z.object({
  dealId: z.string(),
  vendorId: z.string(),
  pdfBase64: z.string().min(1),
});

export const companyLoanCreateSchema = z.object({
  name: z.string().min(1),
  companyOnly: z.boolean().optional(),
});

export const companyLoanUpdateSchema = z.object({
  id: z.string(),
  companyOnly: z.boolean(),
});

// Import in blocco del piano di ammortamento REALE di un finanziamento
// aziendale (CompanyLoan), da un documento della banca: ogni riga è una
// rata vera, non ricalcolata.
export const companyLoanPaymentBulkImportSchema = z.object({
  companyLoanId: z.string(),
  payments: z
    .array(
      z.object({
        dueDate: z.coerce.date(),
        principalPortion: z.number().nonnegative(),
        interestPortion: z.number().nonnegative(),
      }),
    )
    .min(1)
    .max(500),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type DealCreateInput = z.infer<typeof dealCreateSchema>;
export type CostLineItemCreateInput = z.infer<typeof costLineItemCreateSchema>;
export type LoanCreateInput = z.infer<typeof loanCreateSchema>;
export type SaleScenarioUpsertInput = z.infer<typeof saleScenarioUpsertSchema>;
