import { NextRequest, NextResponse } from "next/server";
import { syncAllCalendarSources, isGoogleConfigured } from "@/lib/google-calendar";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Endpoint chamado por uma tarefa agendada externa (não por um usuário
 * logado) para manter a sincronização com o Google Calendar em dia sem
 * depender de alguém clicar em "Sincronizar agora" em Configurações. Exige
 * um segredo em CRON_SECRET — sem essa variável configurada, o endpoint
 * fica desativado (retorna 503) em vez de aberto ao público.
 */
/**
 * Descreve um segredo sem revelá-lo: tamanho e últimos 4 caracteres. O
 * bastante para comparar dois valores no log e ver se batem, sem expor nada.
 */
function impressao(valor: string | null | undefined): string {
  if (valor === undefined) return "ausente";
  if (valor === null) return "não enviado";
  return `${valor.length} chars …${valor.slice(-4)}`;
}

export async function GET(req: NextRequest) {
  // Estes logs saem no "Next.js Server Handler" da Netlify, que é o log que
  // realmente carrega no painel — o da Scheduled Function fica em "Loading"
  // e não mostra nada. Sem isto, uma rejeição aqui é invisível: a função
  // agendada dispara, leva 401, e a única pista é o horário da última
  // sincronização não avançar.
  console.log("[cron] chamada recebida");

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron] recusada: CRON_SECRET não está definida neste runtime");
    return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado" }, { status: 503 });
  }

  const provided = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (provided !== secret) {
    console.error(
      `[cron] recusada: segredo não confere — recebido ${impressao(provided)}, ` +
        `esperado ${impressao(secret)}`
    );
    return NextResponse.json({ ok: false, error: "não autorizado" }, { status: 401 });
  }

  if (!isGoogleConfigured()) {
    console.error("[cron] recusada: Google Calendar não configurado neste runtime");
    return NextResponse.json({ ok: false, error: "Google Calendar não configurado" }, { status: 200 });
  }

  const inicio = Date.now();
  try {
    const summary = await syncAllCalendarSources();
    await logAudit({ action: "sync_google_agendado_executado", entityType: "google_integration", after: summary });
    console.log(
      `[cron] sincronização concluída em ${((Date.now() - inicio) / 1000).toFixed(1)}s —`,
      JSON.stringify(summary)
    );
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error(
      `[cron] sincronização falhou depois de ${((Date.now() - inicio) / 1000).toFixed(1)}s:`,
      err
    );
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
