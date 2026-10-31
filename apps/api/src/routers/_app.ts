import { router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { dealRouter } from "./deal.js";
import { dealSettingsRouter } from "./dealSettings.js";
import { costLineItemRouter } from "./costLineItem.js";
import { loanRouter } from "./loan.js";
import { partnerRouter } from "./partner.js";
import { saleScenarioRouter } from "./saleScenario.js";
import { noteRouter } from "./note.js";
import { vendorRouter } from "./vendor.js";
import { clientRouter } from "./client.js";
import { priceListItemRouter } from "./priceListItem.js";
import { costCategoryRouter } from "./costCategory.js";
import { costTemplateRouter } from "./costTemplate.js";
import { quoteSnapshotRouter } from "./quoteSnapshot.js";
import { revenueRouter } from "./revenue.js";
import { emailRouter } from "./email.js";
import { companyLoanRouter } from "./companyLoan.js";
import { resultsRouter } from "./results.js";
import { surveyChecklistRouter } from "./surveyChecklist.js";

export const appRouter = router({
  auth: authRouter,
  deal: dealRouter,
  dealSettings: dealSettingsRouter,
  costLineItem: costLineItemRouter,
  loan: loanRouter,
  partner: partnerRouter,
  saleScenario: saleScenarioRouter,
  note: noteRouter,
  vendor: vendorRouter,
  clients: clientRouter,
  priceListItem: priceListItemRouter,
  costCategory: costCategoryRouter,
  costTemplate: costTemplateRouter,
  quoteSnapshot: quoteSnapshotRouter,
  revenue: revenueRouter,
  email: emailRouter,
  companyLoan: companyLoanRouter,
  results: resultsRouter,
  surveyChecklist: surveyChecklistRouter,
});

export type AppRouter = typeof appRouter;
