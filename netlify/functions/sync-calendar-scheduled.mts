import type { Config } from "@netlify/functions";

/**
 * Scheduled Function nativa da Netlify: mantém o sistema sincronizado com o
 * Google Calendar automaticamente, sem depender de alguém clicar em
 * "Sincronizar agora" em Configurações → Integrações. Roda a cada 5 minutos
 * (infra da própria Netlify, independente de qualquer agendador externo).
 *
 * Só chama o endpoint /api/cron/sync-calendar (protegido por CRON_SECRET) —
 * mantém toda a lógica de sincronização em um único lugar (src/lib/google-
 * calendar.ts), reaproveitada tanto pelo botão manual quanto por aqui.
 */
export default async () => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET não configurado — sincronização agendada desativada.");
    return;
  }

  const baseUrl = process.env.URL || "https://trivion-selfbooking.netlify.app";
  const url = `${baseUrl}/api/cron/sync-calendar?secret=${encodeURIComponent(secret)}`;

  try {
    const res = await fetch(url);
    const body = await res.text();
    console.log(`Sincronização agendada: HTTP ${res.status} — ${body}`);
  } catch (err) {
    console.error("Sincronização agendada falhou:", err);
  }
};

export const config: Config = {
  schedule: "*/5 * * * *",
};
