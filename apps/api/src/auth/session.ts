import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@flipplan/db";
import { config } from "../config.js";

// Il token di sessione è un valore casuale ad alta entropia (256 bit): a
// differenza delle password non serve un hash lento/salato per proteggerlo,
// basta un hash deterministico (SHA-256) per poterlo cercare in DB senza mai
// salvare il token in chiaro.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  return { token, expiresAt };
}

export async function getUserFromSessionToken(token: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) {
    return null;
  }
  return session.user;
}

export async function destroySessionToken(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}
