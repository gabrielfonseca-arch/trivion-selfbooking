"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/actions/auth";
import { TrivionSymbol, TrivionWordmark } from "@/components/brand/logo";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    undefined
  );

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-navy px-4 py-10 overflow-hidden">
      {/* Halo verde limão discreto — o "brilho" das peças da marca, sem
          atrapalhar a leitura do formulário. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full opacity-[0.18] blur-3xl"
        style={{ background: "radial-gradient(circle, #AFBE19 0%, transparent 70%)" }}
      />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <TrivionSymbol size={56} className="text-brand mb-5" />
          <TrivionWordmark width={168} className="text-white" />
          <p className="brand-eyebrow text-[10px] text-brand mt-2.5">Self Booking</p>
          <p className="text-[var(--sidebar-fg)] text-sm mt-3">
            Central de Controle e Performance Comercial
          </p>
        </div>

        <form action={formAction} className="card bg-white p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="voce@grupotrivion.com"
              className="rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-dark"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-dark"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-brand text-brand-ink text-sm font-semibold py-2.5 hover:bg-brand-dark transition-colors disabled:opacity-60"
          >
            {pending && <Loader2 size={15} className="animate-spin" />}
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-xs text-white/40 mt-6">
          Acesso restrito à equipe do Grupo Trivion.
        </p>
      </div>
    </div>
  );
}
