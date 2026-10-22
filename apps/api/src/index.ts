import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { ensureDefaultCostCategories, ensureSeedCompanyLoans } from "@flipplan/db";
import { appRouter } from "./routers/_app.js";
import { createContext } from "./context.js";
import { config } from "./config.js";

// Avvio del server HTTP (Fastify) con tRPC montato su /trpc.
const fastify = Fastify({ logger: true });

// Idempotente: crea le eventuali nuove categorie di costo di sistema
// mancanti ad ogni avvio, così un nuovo default (es. "Hera (gas)") aggiunto
// al codice raggiunge anche il database di produzione al prossimo deploy,
// senza dover lanciare il seed a mano.
ensureDefaultCostCategories().catch((err) => fastify.log.error(err, "ensureDefaultCostCategories fallito"));

// Idempotente: crea "Mutuo Fabrizio" e "Prestito SRL" (coi piani di
// ammortamento reali della banca) se non esistono già, così i dati che
// l'utente ha fornito raggiungono la produzione in automatico al deploy,
// senza doverli caricare a mano in "Finanziamenti aziendali".
ensureSeedCompanyLoans().catch((err) => fastify.log.error(err, "ensureSeedCompanyLoans fallito"));

await fastify.register(cors, {
  origin: config.webOrigin,
  credentials: true,
});

await fastify.register(cookie);

await fastify.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: {
    router: appRouter,
    createContext,
  },
});

fastify.get("/health", async () => ({ status: "ok" }));

fastify
  .listen({ port: config.port, host: "0.0.0.0" })
  .then(() => {
    fastify.log.info(`FlipPlan API in ascolto sulla porta ${config.port}`);
  })
  .catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });
