import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
