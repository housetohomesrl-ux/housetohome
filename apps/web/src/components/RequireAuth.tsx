import { Navigate, Outlet } from "react-router-dom";
import { trpc } from "../lib/trpc";

export default function RequireAuth() {
  const me = trpc.auth.me.useQuery(undefined, { retry: false });

  if (me.isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Caricamento...</div>;
  }
  if (me.isError || !me.data) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
