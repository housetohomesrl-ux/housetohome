import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context.js";
import { serializeDecimals } from "./lib/serialize.js";

const t = initTRPC.context<Context>().create();

export const router = t.router;

/** Converte i Prisma.Decimal nella risposta in number prima della serializzazione JSON (vedi lib/serialize.ts). */
const withSerializedDecimals = t.middleware(async ({ next }) => {
  const result = await next();
  if (result.ok) {
    return { ...result, data: serializeDecimals(result.data) };
  }
  return result;
});

export const publicProcedure = t.procedure.use(withSerializedDecimals);

/** Richiede un utente autenticato; espone ctx.user non-null a valle. */
export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Devi effettuare l'accesso." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
