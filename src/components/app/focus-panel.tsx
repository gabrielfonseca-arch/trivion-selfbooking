import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type FocusAction = {
  /** Verbo primeiro: o texto já é a instrução do que fazer. */
  label: string;
  count: number;
  /** Uma linha explicando por que isso está na lista. */
  why: string;
  href: string;
  tone: "danger" | "warning" | "brand";
};

const TONE: Record<FocusAction["tone"], { chip: string; bar: string }> = {
  danger: { chip: "bg-red-50 text-red-700 ring-red-600/20", bar: "bg-red-500" },
  warning: { chip: "bg-amber-50 text-amber-700 ring-amber-600/20", bar: "bg-amber-500" },
  brand: { chip: "bg-brand/20 text-brand-strong ring-brand-dark/25", bar: "bg-brand" },
};

/**
 * "Foco de hoje": a resposta para *o que eu faço primeiro?*.
 *
 * Em vez de listar números soltos que o usuário precisa interpretar, cada
 * linha é uma ação já ordenada por urgência — verbo, quantidade, o motivo em
 * uma frase, e um link que leva direto para a tela filtrada naquele recorte.
 * Ações com contagem zero não aparecem: uma lista curta com o que realmente
 * precisa ser feito vale mais do que uma lista completa cheia de zeros.
 */
export function FocusPanel({ actions }: { actions: FocusAction[] }) {
  const pending = actions.filter((a) => a.count > 0);

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 py-3.5 bg-navy">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-brand" />
          <h3 className="brand-eyebrow text-[11px] text-white">Foco de hoje</h3>
        </div>
        <span className="text-[11px] text-white/50">
          {pending.length === 0
            ? "nada pendente"
            : `${pending.length} ${pending.length === 1 ? "frente aberta" : "frentes abertas"}`}
        </span>
      </header>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <CheckCircle2 size={26} className="text-brand-strong" />
          <p className="text-sm font-medium text-foreground">Tudo em dia por aqui.</p>
          <p className="text-xs text-muted max-w-xs">
            Nenhuma confirmação, tarefa ou recuperação pendente no momento.
          </p>
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {pending.map((a, i) => (
            <li key={a.label}>
              <Link
                href={a.href}
                className="group flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <span
                  aria-hidden
                  className={cn("w-1 h-9 rounded-full shrink-0", TONE[a.tone].bar)}
                />
                <span className="text-xs font-semibold text-muted tabular-nums w-4 shrink-0">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{a.label}</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset tabular-nums",
                        TONE[a.tone].chip
                      )}
                    >
                      {a.count}
                    </span>
                  </span>
                  <span className="block text-xs text-muted mt-0.5 line-clamp-2 sm:truncate">{a.why}</span>
                </span>
                <ArrowRight
                  size={16}
                  className="shrink-0 text-muted group-hover:text-brand-strong group-hover:translate-x-0.5 transition-all"
                />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
