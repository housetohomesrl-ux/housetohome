import { TRPCError } from "@trpc/server";
import { prisma } from "@flipplan/db";

/**
 * Verifica che il deal esista e appartenga al tenant dell'utente corrente.
 * Il filtro tenantId è applicato esplicitamente ad ogni accesso ai dati (non
 * ci affidiamo a RLS a livello Postgres in questa fase): questo è il punto
 * centrale in cui viene fatto rispettare l'isolamento multi-tenant.
 * Restituisce NOT_FOUND anche in caso di mismatch di tenant, per non far
 * trapelare l'esistenza di deal di altri tenant.
 */
export async function assertDealAccess(tenantId: string, dealId: string) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal || deal.tenantId !== tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Deal non trovato." });
  }
  return deal;
}
