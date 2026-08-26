import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { googleIntegration, calendarSources, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { isGoogleConfigured } from "@/lib/google-calendar";
import {
  startGoogleConnectAction,
  disconnectGoogleAction,
  addCalendarSourceAction,
  toggleCalendarSourceAction,
  runRealSyncAction,
  simulateNewBookingAction,
  simulateRescheduleLatestAction,
  simulateCancellationLatestAction,
  simulateDuplicateLatestAction,
} from "@/actions/calendar";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { CheckCircle2, AlertCircle } from "lucide-react";

export default async function IntegrationsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;

  const [integration] = await db.select().from(googleIntegration).orderBy(desc(googleIntegration.createdAt)).limit(1);
  const sources = await db.select().from(calendarSources);
  const sdrList = await db.select().from(users).where(eq(users.role, "sdr"));
  const googleConfigured = isGoogleConfigured();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Integrações — Google Calendar</h2>
        <p className="text-sm text-muted mt-1">
          Modelo adotado: uma única conta Google central se conecta via OAuth. Cada closer compartilha a própria
          agenda com essa conta (permissão &quot;Ver todos os detalhes do evento&quot;), e o sistema lê os eventos de
          todas as agendas compartilhadas — sem exigir login individual de cada closer.
        </p>
      </div>

      {sp.connected && (
        <div className="rounded-xl bg-emerald-50 text-emerald-700 px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> Conta Google conectada com sucesso!
        </div>
      )}
      {sp.error && (
        <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> Erro: {sp.error}
        </div>
      )}

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3">Conta central conectada</h3>
        {!googleConfigured && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2.5 mb-3">
            GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET ainda não estão configurados no .env — veja o README para o
            passo a passo de criação das credenciais no Google Cloud Console. Enquanto isso, use o simulador abaixo
            para testar o sistema de ponta a ponta.
          </p>
        )}
        {integration ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{integration.connectedEmail}</p>
              <p className="text-xs text-muted">
                {integration.active ? "Conectada" : "Desconectada"} · atualizado em {formatDateTime(integration.updatedAt)}
              </p>
            </div>
            <form action={disconnectGoogleAction}>
              <button type="submit" className="text-xs font-medium text-red-600 hover:underline">Desconectar</button>
            </form>
          </div>
        ) : (
          <form action={startGoogleConnectAction}>
            <button
              type="submit"
              disabled={!googleConfigured}
              className="rounded-lg bg-brand text-brand-ink text-sm font-medium px-4 py-2 disabled:opacity-50"
            >
              Conectar Google Calendar
            </button>
          </form>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Agendas monitoradas (closers)</h3>
          <form action={async () => { "use server"; await runRealSyncAction(); }}>
            <button type="submit" className="text-xs font-medium text-brand-strong hover:underline">Sincronizar agora</button>
          </form>
        </div>
        <form action={addCalendarSourceAction} className="grid sm:grid-cols-4 gap-2 mb-4">
          <input name="label" placeholder="Nome (ex: Maria - Closer)" required className="rounded-lg border border-border px-2.5 py-2 text-sm" />
          <input name="calendarId" placeholder="E-mail/ID da agenda compartilhada" required className="rounded-lg border border-border px-2.5 py-2 text-sm sm:col-span-2" />
          <select name="sdrUserId" className="rounded-lg border border-border px-2.5 py-2 text-sm">
            <option value="">Sem responsável vinculado</option>
            {sdrList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="submit" className="rounded-lg bg-brand text-brand-ink text-sm font-medium py-2 sm:col-span-4">Adicionar agenda</button>
        </form>

        <div className="flex flex-col divide-y divide-border">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-2.5 gap-3">
              <div>
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-xs text-muted">{s.calendarId} {s.lastSyncAt ? `· última sync: ${formatDateTime(s.lastSyncAt)}` : ""}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={s.active ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-gray-100 text-gray-600 ring-gray-500/20"}>
                  {s.active ? "Ativa" : "Inativa"}
                </Badge>
                <form action={toggleCalendarSourceAction.bind(null, s.id)}>
                  <button type="submit" className="text-xs font-medium text-brand-strong hover:underline">
                    {s.active ? "Desativar" : "Ativar"}
                  </button>
                </form>
              </div>
            </div>
          ))}
          {sources.length === 0 && <p className="text-sm text-muted py-3">Nenhuma agenda cadastrada ainda.</p>}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-1">Simulador de sincronização</h3>
        <p className="text-xs text-muted mb-3">
          Gera eventos realistas de Self Booking e os processa pelo mesmo pipeline da sincronização real — útil para
          testar o sistema (inclusive prevenção de duplicidade) enquanto as credenciais reais não estão configuradas.
        </p>
        <div className="flex flex-wrap gap-2">
          {sdrList[0] && (
            <>
              <form action={async () => { "use server"; await simulateNewBookingAction(sdrList[0].id, 3); }}>
                <button type="submit" className="rounded-lg bg-white border border-border text-xs font-medium px-3 py-2 hover:bg-gray-50">
                  + Novo Self Booking (em 3h — crítico)
                </button>
              </form>
              <form action={async () => { "use server"; await simulateNewBookingAction(sdrList[0].id, 72); }}>
                <button type="submit" className="rounded-lg bg-white border border-border text-xs font-medium px-3 py-2 hover:bg-gray-50">
                  + Novo Self Booking (em 3 dias)
                </button>
              </form>
              <form action={async () => { "use server"; await simulateNewBookingAction(sdrList[0].id, 240); }}>
                <button type="submit" className="rounded-lg bg-white border border-border text-xs font-medium px-3 py-2 hover:bg-gray-50">
                  + Novo Self Booking (em 10 dias — antecedência)
                </button>
              </form>
            </>
          )}
          <form action={async () => { "use server"; await simulateRescheduleLatestAction(); }}>
            <button type="submit" className="rounded-lg bg-white border border-border text-xs font-medium px-3 py-2 hover:bg-gray-50">
              Remarcar última reunião simulada
            </button>
          </form>
          <form action={async () => { "use server"; await simulateCancellationLatestAction(); }}>
            <button type="submit" className="rounded-lg bg-white border border-border text-xs font-medium px-3 py-2 hover:bg-gray-50">
              Cancelar última reunião simulada
            </button>
          </form>
          <form action={async () => { "use server"; await simulateDuplicateLatestAction(); }}>
            <button type="submit" className="rounded-lg bg-white border border-border text-xs font-medium px-3 py-2 hover:bg-gray-50">
              Testar duplicidade (reprocessar mesmo evento)
            </button>
          </form>
        </div>
        {sdrList.length === 0 && <p className="text-xs text-amber-700 mt-2">Cadastre um SDR em Configurações → Usuários para usar o simulador.</p>}
      </div>
    </div>
  );
}
