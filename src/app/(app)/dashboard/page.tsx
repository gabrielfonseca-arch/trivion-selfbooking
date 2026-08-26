import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { meetings, leads, users, tasks } from "@/db/schema";
import { and, eq, gte, lte, asc, or, count, inArray, notInArray } from "drizzle-orm";
import { FocusPanel, type FocusAction } from "@/components/app/focus-panel";
import { getKpis, getAtRiskMeetings, getTasksForUser, getFunnel, getNoShowBreakdown, lastNDays } from "@/lib/queries";
import { StatCard } from "@/components/ui/card";
import { MeetingItem } from "@/components/app/meeting-item";
import { RiskAlertItem } from "@/components/app/risk-alert-item";
import { TaskRow } from "@/components/app/task-row";
import { LinkButton } from "@/components/ui/button";
import { saoPauloDayBounds } from "@/lib/utils";
import { AlertTriangle, CalendarClock, ListChecks, Users2, TrendingDown, TrendingUp, Flame } from "lucide-react";

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

  const { start: startOfTodaySP, end: endOfTodaySP } = saoPauloDayBounds(0);
  const todayConditions = [
    gte(meetings.scheduledAt, startOfTodaySP),
    lte(meetings.scheduledAt, endOfTodaySP),
    sdrFilter ? eq(meetings.sdrUserId, sdrFilter) : undefined,
  ].filter(Boolean);
  const todayMeetings = await db.select().from(meetings).where(and(...todayConditions));
  const confirmacoesPendentes = todayMeetings.filter((m) => !["confirmado", "compareceu", "realizada", "cancelado", "no_show"].includes(m.status)).length;
  const leadsEmRisco = todayMeetings.filter((m) => m.riskLevel === "alto").length;

  // ------------------------------ FOCO DE HOJE ----------------------------
  // Contagens que alimentam o painel "o que eu faço primeiro". São contagens
  // (count) e não listas: só o número aparece na tela, e o link leva para a
  // lista já filtrada.
  const { start: startTomorrowSP, end: endTomorrowSP } = saoPauloDayBounds(1);
  const NAO_CONFIRMADAS = ["agendado", "aguardando_confirmacao", "em_risco"] as const;
  const byS = sdrFilter ? eq(meetings.sdrUserId, sdrFilter) : undefined;

  const [amanhaSemConfirmar, altoRiscoFuturo, noShowsARecuperar] = await Promise.all([
    db
      .select({ n: count() })
      .from(meetings)
      .where(
        and(
          gte(meetings.scheduledAt, startTomorrowSP),
          lte(meetings.scheduledAt, endTomorrowSP),
          inArray(meetings.status, [...NAO_CONFIRMADAS]),
          byS
        )
      ),
    db
      .select({ n: count() })
      .from(meetings)
      .where(
        and(
          gte(meetings.scheduledAt, new Date()),
          eq(meetings.riskLevel, "alto"),
          inArray(meetings.status, [...NAO_CONFIRMADAS, "confirmado"]),
          byS
        )
      ),
    db
      .select({ n: count() })
      .from(meetings)
      .where(
        and(
          eq(meetings.status, "no_show"),
          notInArray(meetings.recoveryStage, ["encerrado_perdido", "recuperado"]),
          byS
        )
      ),
  ]);

  const focusActions: FocusAction[] = [
    {
      label: "Resolver tarefas atrasadas",
      count: tasksData.atrasadas.length,
      why: "Passaram do prazo e continuam abertas",
      href: "/tasks",
      tone: "danger",
    },
    {
      label: "Confirmar reuniões de hoje",
      count: confirmacoesPendentes,
      why: "Acontecem hoje e ainda não tiveram confirmação",
      href: "/self-bookings?filtro=hoje",
      tone: "danger",
    },
    {
      label: "Falar com leads em alto risco",
      count: altoRiscoFuturo[0]?.n ?? 0,
      why: "Score alto de risco de falta — vale um contato antes",
      href: "/self-bookings?filtro=alto_risco",
      tone: "warning",
    },
    {
      label: "Confirmar reuniões de amanhã",
      count: amanhaSemConfirmar[0]?.n ?? 0,
      why: "Confirmar hoje ainda dá tempo de remarcar se precisar",
      href: "/self-bookings?filtro=amanha",
      tone: "warning",
    },
    {
      label: "Recuperar quem faltou",
      count: noShowsARecuperar[0]?.n ?? 0,
      why: "No-shows ainda sem desfecho de recuperação",
      href: "/no-shows",
      tone: "brand",
    },
  ];

  if (isSdr) {
    const firstName = user.name.split(" ")[0];
    const hour = new Date().getHours();
    const saudacao = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{saudacao}, {firstName}</h2>
          <p className="text-sm text-muted mt-1">Comece de cima para baixo — o mais urgente vem primeiro.</p>
        </div>

        <FocusPanel actions={focusActions} />

        {atRisk.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Flame size={15} className="text-red-500" /> Reuniões em risco de falta
              </h3>
              <LinkButton href="/self-bookings?filtro=alto_risco" variant="ghost" size="sm">Ver todas</LinkButton>
            </div>
            <div className="flex flex-col gap-2">
              {atRisk.map((r) => (
                <RiskAlertItem key={r.meeting.id} meeting={r.meeting} lead={r.lead} sdrName={r.sdrName} />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Hoje" value={todayMeetings.length} sub="reuniões" icon={<CalendarClock size={16} className="text-brand-strong" />} />
          <StatCard label="Confirmações pendentes" value={confirmacoesPendentes} tone="warning" icon={<ListChecks size={16} className="text-amber-600" />} />
          <StatCard label="Leads em risco" value={leadsEmRisco} tone="danger" icon={<AlertTriangle size={16} className="text-red-600" />} />
          <StatCard label="Tarefas atrasadas" value={tasksData.atrasadas.length} tone="danger" icon={<ListChecks size={16} className="text-red-600" />} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
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

      <FocusPanel actions={focusActions} />

      {atRisk.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Flame size={15} className="text-red-500" /> Reuniões em risco de falta
            </h3>
            <LinkButton href="/self-bookings?filtro=alto_risco" variant="ghost" size="sm">Ver todas</LinkButton>
          </div>
          <div className="flex flex-col gap-2">
            {atRisk.slice(0, 5).map((r) => (
              <RiskAlertItem key={r.meeting.id} meeting={r.meeting} lead={r.lead} sdrName={r.sdrName} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Self Bookings" value={kpisWeek.total} icon={<CalendarClock size={16} className="text-brand-strong" />} />
        <StatCard label="Comparecimento" value={`${kpisWeek.taxaComparecimento}%`} tone="success" icon={<TrendingUp size={16} className="text-emerald-600" />} />
        <StatCard label="No-show" value={`${kpisWeek.taxaNoShow}%`} tone="danger" icon={<TrendingDown size={16} className="text-red-600" />} />
        <StatCard label="Confirmações" value={`${kpisWeek.taxaConfirmacao}%`} tone="brand" icon={<ListChecks size={16} className="text-brand-strong" />} />
        <StatCard label="Leads em risco (hoje)" value={leadsEmRisco} tone="warning" icon={<AlertTriangle size={16} className="text-amber-600" />} />
      </div>

      <div className="card p-5">
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
                  <span className="text-[10px] text-brand-ink font-semibold">{step.value}</span>
                </div>
              </div>
              <div className="w-14 text-xs text-muted text-right shrink-0">{step.conversionFromStart}%</div>
            </div>
          ))}
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
