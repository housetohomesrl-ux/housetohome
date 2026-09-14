import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@flipplan/api";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type DealDetail = RouterOutputs["deal"]["get"];
export type CostLineItemDetail = DealDetail["costLineItems"][number];
export type LoanDetail = DealDetail["loans"][number];
