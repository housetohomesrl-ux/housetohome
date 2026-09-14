export const config = {
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "flipplan_session",
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 30),
  isProduction: process.env.NODE_ENV === "production",
};
