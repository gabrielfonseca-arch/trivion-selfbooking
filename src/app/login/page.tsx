"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    undefined
  );

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--sidebar-bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand text-white font-bold text-lg mb-4">
            T
          </div>
          <h1 className="text-white text-xl font-semibold tracking-tight">
            TRIVION | SELF BOOKING
          </h1>
          <p className="text-[var(--sidebar-fg)] text-sm mt-1">
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
              placeholder="voce@grupotrivion.com"
              className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/40"
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
              placeholder="••••••••"
              className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-lg bg-brand text-white text-sm font-medium py-2.5 hover:bg-brand-dark transition-colors disabled:opacity-60"
          >
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-xs text-[var(--sidebar-fg)] mt-6">
          Acesso restrito à equipe do Grupo Trivion.
        </p>
      </div>
    </div>
  );
}
