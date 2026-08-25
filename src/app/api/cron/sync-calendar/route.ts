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
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado" }, { status: 503 });
  }

  const provided = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: "não autorizado" }, { status: 401 });
  }

  if (!isGoogleConfigured()) {
    return NextResponse.json({ ok: false, error: "Google Calendar não configurado" }, { status: 200 });
  }

  try {
    const summary = await syncAllCalendarSources();
    await logAudit({ action: "sync_google_agendado_executado", entityType: "google_integration", after: summary });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
