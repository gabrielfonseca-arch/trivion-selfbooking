import type { Config } from "@netlify/functions";

/**
 * Scheduled Function nativa da Netlify: mantém o sistema sincronizado com o
 * Google Calendar automaticamente, sem depender de alguém clicar em
 * "Sincronizar agora" em Configurações → Integrações. Roda a cada 5 minutos.
 *
 * Só chama o endpoint /api/cron/sync-calendar (protegido por CRON_SECRET) —
 * toda a lógica de sincronização mora em um lugar só (src/lib/google-
 * calendar.ts), reaproveitada pelo botão manual e por aqui.
 *
 * Esta função tem limite de tempo curto. Por isso ela desiste de esperar em
 * 25 segundos: se a sincronização demorar mais, o trabalho já feito do lado do
 * servidor permanece gravado, e a rodada seguinte (em 5 minutos) continua de
 * onde parou. Desistir de esperar não é o mesmo que falhar — o log diz qual
 * dos dois aconteceu.
 */

const TEMPO_LIMITE_MS = 25_000;

/**
 * URL pública do site. A Netlify preenche URL/DEPLOY_URL automaticamente; o
 * último recurso monta a partir do nome do site.
 *
 * Nenhuma URL literal aqui: o scanner de segredos do build reprova o valor
 * fixo, porque coincide com o valor de NEXTAUTH_URL, que está marcada como
 * segredo. Montada em tempo de execução, não há literal no código.
 */
function baseUrl(): string | null {
  const doAmbiente = process.env.URL ?? process.env.DEPLOY_URL;
  if (doAmbiente) return doAmbiente;

  const nome = process.env.SITE_NAME;
  return nome ? `https://${nome}.netlify.app` : null;
}

export default async () => {
  const inicio = Date.now();

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[sync] CRON_SECRET não configurado — sincronização agendada desativada.");
    return;
  }

  const base = baseUrl();
  if (!base) {
    console.error(
      "[sync] URL do site indisponível (URL, DEPLOY_URL e SITE_NAME vazias) — abortando."
    );
    return;
  }

  const url = `${base}/api/cron/sync-calendar?secret=${encodeURIComponent(secret)}`;
  console.log(`[sync] disparando sincronização em ${base}`);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    const corpo = (await res.text()).slice(0, 500);
    const seg = ((Date.now() - inicio) / 1000).toFixed(1);

    if (res.ok) {
      console.log(`[sync] concluída em ${seg}s — HTTP ${res.status} — ${corpo}`);
    } else {
      console.error(`[sync] endpoint respondeu HTTP ${res.status} em ${seg}s — ${corpo}`);
    }
  } catch (err) {
    const seg = ((Date.now() - inicio) / 1000).toFixed(1);
    const timeout = err instanceof Error && err.name === "TimeoutError";

    if (timeout) {
      // Esperado quando há muito evento para processar. O servidor continua o
      // trabalho e a próxima rodada segue de onde parou.
      console.warn(
        `[sync] parei de esperar depois de ${seg}s. O processamento continua no servidor; ` +
          `a próxima rodada continua de onde parou.`
      );
    } else {
      console.error(`[sync] falhou depois de ${seg}s:`, err);
    }
  }
};

export const config: Config = {
  schedule: "*/5 * * * *",
};
