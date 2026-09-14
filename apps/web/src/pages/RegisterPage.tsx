import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerSchema } from "@flipplan/shared";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/Button";
import { Input, Label } from "../components/ui/Field";

export default function RegisterPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ companyName: "", name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const register = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/");
    },
    onError: (err) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dati non validi");
      return;
    }
    setError(null);
    register.mutate(parsed.data);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Crea il tuo account FlipPlan</h1>
        <p className="mt-1 text-sm text-slate-500">Un unico account per la tua azienda/team</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="companyName">Nome azienda / team</Label>
            <Input
              id="companyName"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="name">Il tuo nome</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={register.isPending}>
            {register.isPending ? "Creazione in corso..." : "Crea account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Hai già un account?{" "}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  );
}
