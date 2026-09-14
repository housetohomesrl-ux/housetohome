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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold text-slate-900">
            FlipPlan
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">
              Portafoglio
            </Link>
            <Link to="/vendors" className="text-sm text-slate-600 hover:text-slate-900">
              Fornitori
            </Link>
            <Link to="/price-list" className="text-sm text-slate-600 hover:text-slate-900">
              Libreria prezzi
            </Link>
            <span className="text-sm text-slate-400">{me.data?.name}</span>
            <Button variant="secondary" onClick={() => logout.mutate()}>
              Esci
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
