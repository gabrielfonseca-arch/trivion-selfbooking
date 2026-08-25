import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { meetings, leads, users, tasks } from "@/db/schema";
import { and, eq, gte, lte, asc, or, ne } from "drizzle-orm";
import { getKpis, getAtRiskMeetings, getTasksForUser, getFunnel, getNoShowBreakdown, lastNDays } from "@/lib/queries";
import { StatCard } from "@/components/ui/card";
import { MeetingItem } from "@/components/app/meeting-item";
import { RiskAlertItem } from "@/components/app/risk-alert-item";
import { TaskRow } from "@/components/app/task-row";
import { LinkButton } from "@/components/ui/button";
import { AlertTriangle, CalendarClock, ListChecks, Users2, TrendingDown, TrendingUp } from "lucide-react";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const isSdr = user.role === "sdr";
  const sdrFilter = isSdr ? user.id : undefined;

  const [atRisk, tasksData] = await Promise.all([
    getAtRiskMeetings(8, sdrFilter),
    getTasksForUser(sdrFilter),
  ]);

  const upcomingConditions = [
    or(eq(meetings.status, "agendado"), eq(meetings.status, "aguardando_confirmacao"), eq(meetings.status, "confirmado"), eq(meetings.status, "em_risco")),
    gte(meetings.scheduledAt, new Date()),
    sdrFilter ? eq(meetings.sdrUserId, sdrFilter) : undefined,
  ].filter(Boolean);

  const upcoming = await db
    .select({ meeting: meetings, lead: leads, sdrName: users.name })
    .from(meetings)
    .innerJoin(leads, eq(meetings.leadId, leads.id))
    .leftJoin(users, eq(meetings.sdrUserId, users.id))
    .where(and(...upcomingConditions))
    .orderBy(asc(meetings.scheduledAt))
    .limit(6);

  const todayConditions = [
    gte(meetings.scheduledAt, startOfToday()),
    lte(meetings.scheduledAt, endOfToday()),
    sdrFilter ? eq(meetings.sdrUserId, sdrFilter) : undefined,
  ].filter(Boolean);
  const todayMeetings = await db.select().from(meetings).where(and(...todayConditions));
  const confirmacoesPendentes = todayMeetings.filter((m) => !["confirmado", "compareceu", "realizada", "cancelado", "no_show"].includes(m.status)).length;
  const leadsEmRisco = todayMeetings.filter((m) => m.riskLevel === "alto").length;

  if (isSdr) {
    const firstName = user.name.split(" ")[0];
    const hour = new Date().getHours();
    const saudacao = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{saudacao}, {firstName} 👋</h2>
          <p className="text-sm text-muted mt-1">Aqui está o que você precisa fazer agora.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Hoje" value={todayMeetings.length} sub="reuniões" icon={<CalendarClock size={16} className="text-brand" />} />
          <StatCard label="Confirmações pendentes" value={confirmacoesPendentes} tone="warning" icon={<ListChecks size={16} className="text-amber-600" />} />
          <StatCard label="Leads em risco" value={leadsEmRisco} tone="danger" icon={<AlertTriangle size={16} className="text-red-600" />} />
          <StatCard label="Tarefas atrasadas" value={tasksData.atrasadas.length} tone="danger" icon={<ListChecks size={16} className="text-red-600" />} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">🚨 Prioridade agora</h3>
              <LinkButton href="/self-bookings" variant="ghost" size="sm">Ver tudo</LinkButton>
            </div>
            <div className="flex flex-col gap-2">
              {atRisk.length === 0 && <p className="text-sm text-muted py-4 text-center">Nenhuma reunião em risco no momento. 🎉</p>}
              {atRisk.map((r) => (
                <RiskAlertItem key={r.meeting.id} meeting={r.meeting} lead={r.lead} sdrName={r.sdrName} />
              ))}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">📅 Próximas reuniões</h3>
              <LinkButton href="/agenda" variant="ghost" size="sm">Ver agenda</LinkButton>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {upcoming.length === 0 && <p className="text-sm text-muted py-4 text-center">Nenhuma reunião futura.</p>}
              {upcoming.map((m) => (
                <MeetingItem key={m.meeting.id} meeting={m.meeting} lead={m.lead} showDate />
              ))}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">✅ Tarefas de hoje</h3>
            <LinkButton href="/tasks" variant="ghost" size="sm">Minhas tarefas</LinkButton>
          </div>
          <div className="flex flex-col gap-2">
            {[...tasksData.atrasadas, ...tasksData.hoje].length === 0 && (
              <p className="text-sm text-muted py-4 text-center">Nenhuma tarefa para hoje. 🎉</p>
            )}
            {[...tasksData.atrasadas, ...tasksData.hoje].slice(0, 6).map((t) => (
              <TaskRow key={t.task.id} task={t.task} lead={t.lead} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------- COORDENADOR / ADMIN --------------------
  const [kpisWeek, funnel, noShow] = await Promise.all([
    getKpis(lastNDays(7)),
    getFunnel(lastNDays(30)),
    getNoShowBreakdown(lastNDays(30)),
  ]);

  const sdrList = await db.select().from(users).where(eq(users.role, "sdr"));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Visão geral da operação</h2>
        <p className="text-sm text-muted mt-1">Últimos 7 dias · Self Booking — Grupo Trivion</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Self Bookings" value={kpisWeek.total} icon={<CalendarClock size={16} className="text-brand" />} />
        <StatCard label="Comparecimento" value={`${kpisWeek.taxaComparecimento}%`} tone="success" icon={<TrendingUp size={16} className="text-emerald-600" />} />
        <StatCard label="No-show" value={`${kpisWeek.taxaNoShow}%`} tone="danger" icon={<TrendingDown size={16} className="text-red-600" />} />
        <StatCard label="Confirmações" value={`${kpisWeek.taxaConfirmacao}%`} tone="brand" icon={<ListChecks size={16} className="text-brand" />} />
        <StatCard label="Leads em risco (hoje)" value={leadsEmRisco} tone="warning" icon={<AlertTriangle size={16} className="text-amber-600" />} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4">Funil de Self Booking (30 dias)</h3>
          <div className="flex flex-col gap-2">
            {funnel.map((step) => (
              <div key={step.label} className="flex items-center gap-3">
                <div className="w-40 text-xs text-muted shrink-0">{step.label}</div>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(step.conversionFromStart, 4)}%` }}
                  >
                    <span className="text-[10px] text-white font-medium">{step.value}</span>
                  </div>
                </div>
                <div className="w-14 text-xs text-muted text-right shrink-0">{step.conversionFromStart}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3">🔥 Precisa da sua atenção</h3>
          <div className="flex flex-col gap-2">
            {atRisk.slice(0, 5).map((r) => (
              <RiskAlertItem key={r.meeting.id} meeting={r.meeting} lead={r.lead} sdrName={r.sdrName} />
            ))}
            {tasksData.atrasadas.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {tasksData.atrasadas.length} tarefa(s) atrasada(s) na operação.
              </div>
            )}
            {atRisk.length === 0 && tasksData.atrasadas.length === 0 && (
              <p className="text-sm text-muted py-4 text-center">Tudo sob controle. 🎉</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3">Performance por SDR</h3>
          <div className="flex flex-col divide-y divide-border">
            {sdrList.map((sdr) => (
              <SdrRow key={sdr.id} sdrId={sdr.id} name={sdr.name} />
            ))}
            {sdrList.length === 0 && <p className="text-sm text-muted py-4 text-center">Nenhum SDR cadastrado.</p>}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3">No-show por dia da semana (30 dias)</h3>
          <div className="flex flex-col gap-2">
            {noShow.porDiaSemana.map((d) => (
              <div key={d.key} className="flex items-center gap-3">
                <div className="w-20 text-xs text-muted shrink-0">{d.key}</div>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(d.rate, 100)}%` }} />
                </div>
                <div className="w-12 text-xs text-muted text-right shrink-0">{d.rate}%</div>
              </div>
            ))}
            {noShow.porDiaSemana.length === 0 && <p className="text-sm text-muted py-4 text-center">Sem dados suficientes ainda.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

async function SdrRow({ sdrId, name }: { sdrId: string; name: string }) {
  const kpis = await getKpis(lastNDays(30), sdrId);
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2">
        <Users2 size={15} className="text-muted" />
        <span className="text-sm font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted">
        <span>{kpis.total} reuniões</span>
        <span className="text-emerald-600 font-medium">{kpis.taxaComparecimento}% comp.</span>
        <span className="text-red-600 font-medium">{kpis.taxaNoShow}% no-show</span>
      </div>
    </div>
  );
}
