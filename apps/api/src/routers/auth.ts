import "@fastify/cookie";
import { TRPCError } from "@trpc/server";
import { prisma } from "@flipplan/db";
import { loginSchema, registerSchema } from "@flipplan/shared";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { createSession, destroySessionToken } from "../auth/session.js";
import { config } from "../config.js";
import { protectedProcedure, publicProcedure, router } from "../trpc.js";

function setSessionCookie(res: import("fastify").FastifyReply, token: string, expiresAt: Date) {
  res.setCookie(config.sessionCookieName, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export const authRouter = router({
  register: publicProcedure.input(registerSchema).mutation(async ({ input, ctx }) => {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: "Esiste già un account con questa email." });
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: input.companyName } });
      return tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.email,
          passwordHash,
          name: input.name,
          role: "OWNER",
        },
      });
    });

    const { token, expiresAt } = await createSession(user.id);
    setSessionCookie(ctx.res, token, expiresAt);

    return { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId };
  }),

  login: publicProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    const invalidCredentialsError = new TRPCError({ code: "UNAUTHORIZED", message: "Email o password non validi." });
    if (!user) throw invalidCredentialsError;

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) throw invalidCredentialsError;

    const { token, expiresAt } = await createSession(user.id);
    setSessionCookie(ctx.res, token, expiresAt);

    return { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId };
  }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const token = ctx.req.cookies?.[config.sessionCookieName];
    if (token) await destroySessionToken(token);
    ctx.res.clearCookie(config.sessionCookieName, { path: "/" });
    return { success: true };
  }),

  me: protectedProcedure.query(({ ctx }) => {
    return {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      role: ctx.user.role,
      tenantId: ctx.user.tenantId,
    };
  }),
});
