import { NextRequest, NextResponse } from "next/server";
import { syncAllCalendarSources, isGoogleConfigured } from "@/lib/google-calendar";
import { logAudit } from "@/lib/audit";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

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

/**
 * Registra no banco o desfecho de cada chamada a este endpoint.
 *
 * Existe porque o log das funções da Netlify não carrega no painel: uma
 * chamada recusada some sem deixar rastro, e a única pista é o horário da
 * sincronização não avançar. Gravando aqui, a própria resposta do endpoint
 * (ver `ultimasChamadas` abaixo) mostra o que as chamadas automáticas
 * fizeram.
 */
async function registrarChamada(req: NextRequest, resultado: string, detalhe?: unknown) {
  try {
    await logAudit({
      action: "cron_chamada",
      entityType: "google_integration",
      after: {
        resultado,
        detalhe: detalhe ?? null,
        // Identifica quem chamou: a função agendada da Netlify tem
        // user-agent próprio, diferente de um navegador.
        userAgent: req.headers.get("user-agent"),
        origem: req.headers.get("x-nf-request-id") ? "netlify" : "externo",
        temSecretNaQuery: req.nextUrl.searchParams.has("secret"),
        temSecretNoHeader: Boolean(req.headers.get("x-cron-secret")),
      },
    });
  } catch {
    // registro é diagnóstico: nunca deve derrubar a sincronização
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    await registrarChamada(req, "recusada", "CRON_SECRET ausente no runtime");
    return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado" }, { status: 503 });
  }

  const provided = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (provided !== secret) {
    await registrarChamada(req, "recusada", {
      motivo: "segredo não confere",
      recebido: impressao(provided),
      esperado: impressao(secret),
    });
    return NextResponse.json({ ok: false, error: "não autorizado" }, { status: 401 });
  }

  if (!isGoogleConfigured()) {
    await registrarChamada(req, "recusada", "Google Calendar não configurado");
    return NextResponse.json({ ok: false, error: "Google Calendar não configurado" }, { status: 200 });
  }

  try {
    const summary = await syncAllCalendarSources();
    await logAudit({ action: "sync_google_agendado_executado", entityType: "google_integration", after: summary });
    await registrarChamada(req, "ok", summary);
    const ultimasChamadas = await db
      .select({ em: auditLogs.createdAt, dados: auditLogs.after })
      .from(auditLogs)
      .where(eq(auditLogs.action, "cron_chamada"))
      .orderBy(desc(auditLogs.createdAt))
      .limit(12);
    return NextResponse.json({ ok: true, summary, ultimasChamadas });
  } catch (err) {
    await registrarChamada(req, "erro", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
