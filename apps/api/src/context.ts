import "@fastify/cookie";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { getUserFromSessionToken } from "./auth/session.js";
import { config } from "./config.js";

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  const token = req.cookies?.[config.sessionCookieName];
  const user = token ? await getUserFromSessionToken(token) : null;
  return { req, res, user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
