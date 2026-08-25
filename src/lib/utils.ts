import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fuso horário de referência do sistema (Brasília). As funções de Netlify
// rodam em UTC por padrão — sem fixar o timeZone aqui, todos os horários
// exibidos ficariam 3h adiantados em relação ao horário real de Brasília.
export const APP_TIME_ZONE = "America/Sao_Paulo";

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR", { timeZone: APP_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("pt-BR", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
}

/**
 * Início e fim de um dia civil em Brasília (não no fuso do servidor),
 * retornados como instantes UTC. `offsetDays` 0 = hoje, 1 = amanhã, etc.
 * Usado para filtrar reuniões "de hoje/amanhã" de forma consistente com o
 * que o usuário vê na tela, já que o Brasil não observa horário de verão
 * desde 2019 (offset fixo -03:00).
 */
export function saoPauloDayBounds(offsetDays: number = 0): { start: Date; end: Date } {
  const ymdInSaoPaulo = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(new Date());
  const [y, m, d] = ymdInSaoPaulo.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  const yy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(base.getUTCDate()).padStart(2, "0");
  const start = new Date(`${yy}-${mm}-${dd}T00:00:00-03:00`);
  const end = new Date(`${yy}-${mm}-${dd}T23:59:59.999-03:00`);
  return { start, end };
}

export function formatRelativeToNow(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = d.getTime() - Date.now();
  const diffH = diffMs / (1000 * 60 * 60);

  if (Math.abs(diffH) < 1) {
    const diffMin = Math.round(diffMs / (1000 * 60));
    if (diffMin === 0) return "agora";
    return diffMin > 0 ? `em ${diffMin} min` : `há ${Math.abs(diffMin)} min`;
  }
  if (Math.abs(diffH) < 24) {
    const h = Math.round(diffH);
    return h > 0 ? `em ${h}h` : `há ${Math.abs(h)}h`;
  }
  const days = Math.round(diffH / 24);
  return days > 0 ? `em ${days} dia${days > 1 ? "s" : ""}` : `há ${Math.abs(days)} dia${Math.abs(days) > 1 ? "s" : ""}`;
}

export function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
