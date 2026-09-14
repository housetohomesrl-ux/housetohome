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
import { priceListItemRouter } from "./priceListItem.js";
import { costCategoryRouter } from "./costCategory.js";
import { resultsRouter } from "./results.js";

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
  priceListItem: priceListItemRouter,
  costCategory: costCategoryRouter,
  results: resultsRouter,
});

export type AppRouter = typeof appRouter;
