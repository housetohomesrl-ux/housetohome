import { createTRPCReact, type CreateTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@flipplan/api";

export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>();

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      fetch(url, options) {
        return fetch(url, { ...options, credentials: "include" });
      },
    }),
  ],
});
