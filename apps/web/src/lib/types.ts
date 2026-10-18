import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@flipplan/api";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type DealDetail = RouterOutputs["deal"]["get"];
export type CostLineItemDetail = DealDetail["costLineItems"][number];
export type LoanDetail = DealDetail["loans"][number];
export type CostCategory = RouterOutputs["costCategory"]["list"][number];
export type PriceListItem = RouterOutputs["priceListItem"]["list"][number];
export type DealSummary = RouterOutputs["deal"]["list"][number];
export type Vendor = RouterOutputs["vendor"]["list"][number];
export type Client = RouterOutputs["clients"]["list"][number];
export type CostTemplate = RouterOutputs["costTemplate"]["list"][number];
export type QuoteSnapshot = RouterOutputs["quoteSnapshot"]["list"][number];
