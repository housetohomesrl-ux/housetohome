import { Link, Outlet, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/Button";

export default function AppLayout() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery();

  const logout = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/login");
    },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-baseline gap-2">
              <span className="text-lg font-semibold text-slate-900">FlipPlan</span>
              {me.data?.tenantName && (
                <span className="text-sm font-medium uppercase tracking-wide text-slate-400">{me.data.tenantName}</span>
              )}
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">{me.data?.name}</span>
              <Button variant="secondary" onClick={() => logout.mutate()}>
                Esci
              </Button>
            </div>
          </div>
          <nav className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2">
            <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">
              Portafoglio
            </Link>
            <Link to="/vendors" className="text-sm text-slate-600 hover:text-slate-900">
              Fornitori
            </Link>
            <Link to="/clients" className="text-sm text-slate-600 hover:text-slate-900">
              Clienti
            </Link>
            <Link to="/price-list/flip" className="text-sm text-slate-600 hover:text-slate-900">
              Libreria prezzi Flip
            </Link>
            <Link to="/price-list/ristrutturazione" className="text-sm text-slate-600 hover:text-slate-900">
              Libreria prezzi Ristrutturazioni
            </Link>
            <Link to="/revenue/flip" className="text-sm text-slate-600 hover:text-slate-900">
              Fatturato Flip
            </Link>
            <Link to="/revenue/ristrutturazione" className="text-sm text-slate-600 hover:text-slate-900">
              Fatturato Ristrutturazione
            </Link>
            <Link to="/company-loans" className="text-sm text-slate-600 hover:text-slate-900">
              Finanziamenti aziendali
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
