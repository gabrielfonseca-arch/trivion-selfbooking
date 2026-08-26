"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, CornerDownLeft } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MEETING_STATUS_LABEL, LEAD_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Result = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  riskLevel: string;
  nextMeeting: { scheduledAt: string; status: string } | null;
};

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Busca rápida global: acha um lead ou uma reunião de qualquer tela, sem
 * precisar navegar até a lista certa antes. Abre com Ctrl+K (ou ⌘K) e navega
 * com as setas + Enter, para quem prefere não tirar a mão do teclado.
 */
export function QuickSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);

  // Atalho de teclado global.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fecha ao clicar fora.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Busca com debounce, descartando respostas que chegam fora de ordem.
  // Nenhum setState acontece de forma síncrona aqui dentro: tudo roda depois
  // do timer ou da resposta, para não disparar renderizações em cascata.
  useEffect(() => {
    const term = query.trim();
    const controller = new AbortController();

    if (term.length < 2) {
      const clear = setTimeout(() => {
        setResults([]);
        setLoading(false);
      }, 0);
      return () => clearTimeout(clear);
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setResults(data.results ?? []);
        setCursor(0);
        setOpen(true);
      } catch {
        // abortada por uma digitação mais nova — ignora
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function go(id: string) {
    setOpen(false);
    setQuery("");
    router.push(`/leads/${id}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[cursor].id);
    }
  }

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative flex-1 max-w-md">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
      />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Buscar lead, empresa ou telefone..."
        aria-label="Busca rápida"
        className="w-full rounded-lg border border-border bg-surface pl-9 pr-16 py-2 text-sm outline-none focus:border-brand-dark"
      />
      <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted pointer-events-none">
        {loading ? <Loader2 size={11} className="animate-spin" /> : "Ctrl K"}
      </kbd>

      {showPanel && (
        <div className="absolute left-0 right-0 mt-2 card p-1.5 shadow-lg z-40 max-h-96 overflow-y-auto">
          {results.length === 0 && !loading && (
            <p className="text-sm text-muted px-3 py-6 text-center">
              Nenhum lead encontrado para “{query.trim()}”.
            </p>
          )}

          {results.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onMouseEnter={() => setCursor(i)}
              onClick={() => go(r.id)}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                i === cursor ? "bg-brand/15" : "hover:bg-gray-50"
              )}
            >
              <Avatar name={r.name} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                <p className="text-xs text-muted truncate">
                  {[r.company, r.email ?? r.phone].filter(Boolean).join(" · ") ||
                    LEAD_STATUS_LABEL[r.status] ||
                    r.status}
                </p>
              </div>
              {r.nextMeeting && (
                <span className="shrink-0 text-[11px] text-muted text-right leading-tight">
                  {DATE_FMT.format(new Date(r.nextMeeting.scheduledAt))}
                  <br />
                  <span className="text-brand-strong font-medium">
                    {MEETING_STATUS_LABEL[r.nextMeeting.status] ?? r.nextMeeting.status}
                  </span>
                </span>
              )}
              {i === cursor && (
                <CornerDownLeft size={13} className="shrink-0 text-muted hidden sm:block" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
