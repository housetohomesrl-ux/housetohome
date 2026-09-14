import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginSchema } from "@flipplan/shared";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/Button";
import { Input, Label } from "../components/ui/Field";

export default function LoginPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/");
    },
    onError: (err) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dati non validi");
      return;
    }
    setError(null);
    login.mutate(parsed.data);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">FlipPlan</h1>
        <p className="mt-1 text-sm text-slate-500">Accedi al tuo account</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? "Accesso in corso..." : "Accedi"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Non hai un account?{" "}
          <Link to="/register" className="font-medium text-brand-600 hover:underline">
            Registrati
          </Link>
        </p>
      </div>
    </div>
  );
}
