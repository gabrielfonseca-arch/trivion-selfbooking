import { db } from "@/db";
import { meetings, leads, users, tasks, interactions } from "@/db/schema";
import { and, eq, gte, lte, desc, asc, or, ne, inArray } from "drizzle-orm";

export type DateRange = { from: Date; to: Date };

export function lastNDays(n: number): DateRange {
  const to = new Date();
  const from = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return { from, to };
}

// ---------------------------------------------------------------------------
// KPIs GERAIS
// ---------------------------------------------------------------------------

export async function getKpis(range?: DateRange, sdrUserId?: string) {
  const conditions = [
    range ? gte(meetings.scheduledAt, range.from) : undefined,
    range ? lte(meetings.scheduledAt, range.to) : undefined,
    sdrUserId ? eq(meetings.sdrUserId, sdrUserId) : undefined,
  ].filter(Boolean);

  const rows = await db
    .select()
    .from(meetings)
    .where(conditions.length ? and(...conditions) : undefined);

  const total = rows.length;
  const confirmados = rows.filter((r) => ["confirmado", "compareceu", "realizada"].includes(r.status)).length;
  const compareceram = rows.filter((r) => ["compareceu", "realizada"].includes(r.status)).length;
  const noShow = rows.filter((r) => r.status === "no_show").length;
  const cancelamentos = rows.filter((r) => r.status === "cancelado").length;
  const remarcacoes = rows.filter((r) => r.status === "remarcado").length;
  const emRisco = rows.filter((r) => r.riskLevel === "alto" && !["cancelado", "no_show", "compareceu", "realizada"].includes(r.status)).length;
  const realizadasOuNoShow = compareceram + noShow;

  return {
    total,
    confirmados,
    compareceram,
    noShow,
    cancelamentos,
    remarcacoes,
    emRisco,
    taxaConfirmacao: total ? Math.round((confirmados / total) * 1000) / 10 : 0,
    taxaComparecimento: realizadasOuNoShow ? Math.round((compareceram / realizadasOuNoShow) * 1000) / 10 : 0,
    taxaNoShow: realizadasOuNoShow ? Math.round((noShow / realizadasOuNoShow) * 1000) / 10 : 0,
    taxaCancelamento: total ? Math.round((cancelamentos / total) * 1000) / 10 : 0,
    taxaRemarcacao: total ? Math.round((remarcacoes / total) * 1000) / 10 : 0,
  };
}

// ---------------------------------------------------------------------------
// FUNIL
// ---------------------------------------------------------------------------

export async function getFunnel(range?: DateRange) {
  const conditions = [
    range ? gte(meetings.scheduledAt, range.from) : undefined,
    range ? lte(meetings.scheduledAt, range.to) : undefined,
  ].filter(Boolean);

  const rows = await db.select().from(meetings).where(conditions.length ? and(...conditions) : undefined);
  const leadIds = new Set(rows.map((r) => r.leadId));

  const contatoRealizado = await db
    .select({ leadId: interactions.leadId })
    .from(interactions)
    .where(ne(interactions.channel, "sistema"));
  const leadsComContato = new Set(contatoRealizado.map((c) => c.leadId));

  const selfBooking = rows.length;
  const contato = rows.filter((r) => leadsComContato.has(r.leadId)).length;
  const confirmado = rows.filter((r) => ["confirmado", "compareceu", "realizada"].includes(r.status)).length;
  const compareceu = rows.filter((r) => ["compareceu", "realizada"].includes(r.status)).length;
  const realizada = rows.filter((r) => r.status === "realizada" || r.status === "compareceu").length;
  const leadIdList = Array.from(leadIds);
  const oportunidade = leadIdList.length
    ? await db
        .select()
        .from(leads)
        .where(and(eq(leads.status, "oportunidade"), inArray(leads.id, leadIdList)))
    : [];

  const steps = [
    { label: "Self Booking", value: selfBooking },
    { label: "Contato realizado", value: contato },
    { label: "Confirmado", value: confirmado },
    { label: "Compareceu", value: compareceu },
    { label: "Reunião realizada", value: realizada },
    { label: "Oportunidade", value: oportunidade.length },
  ];

  return steps.map((step, i) => ({
    ...step,
    conversionFromStart: selfBooking ? Math.round((step.value / selfBooking) * 1000) / 10 : 0,
    conversionFromPrev:
      i === 0 ? 100 : steps[i - 1].value ? Math.round((step.value / steps[i - 1].value) * 1000) / 10 : 0,
  }));
}

// ---------------------------------------------------------------------------
// NO-SHOW ANALYTICS
// ---------------------------------------------------------------------------

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export async function getNoShowBreakdown(range?: DateRange) {
  const conditions = [
    range ? gte(meetings.scheduledAt, range.from) : undefined,
    range ? lte(meetings.scheduledAt, range.to) : undefined,
  ].filter(Boolean);

  const rows = await db
    .select({
      id: meetings.id,
      status: meetings.status,
      scheduledAt: meetings.scheduledAt,
      createdAt: meetings.createdAt,
      riskLevel: meetings.riskLevel,
      sdrUserId: meetings.sdrUserId,
      sdrName: users.name,
      noShowReason: meetings.noShowReason,
    })
    .from(meetings)
    .leftJoin(users, eq(meetings.sdrUserId, users.id))
    .where(conditions.length ? and(...conditions) : undefined);

  const closed = rows.filter((r) => ["no_show", "compareceu", "realizada"].includes(r.status));
  const noShows = rows.filter((r) => r.status === "no_show");

  function bucketBy<T extends string>(items: typeof rows, keyFn: (r: (typeof rows)[number]) => T) {
    const map = new Map<T, { noShow: number; total: number }>();
    for (const item of closed) {
      const key = keyFn(item);
      const entry = map.get(key) ?? { noShow: 0, total: 0 };
      entry.total++;
      if (item.status === "no_show") entry.noShow++;
      map.set(key, entry);
    }
    return Array.from(map.entries()).map(([key, v]) => ({
      key,
      noShow: v.noShow,
      total: v.total,
      rate: v.total ? Math.round((v.noShow / v.total) * 1000) / 10 : 0,
    }));
  }

  const porSdr = bucketBy(rows, (r) => r.sdrName ?? "Sem responsável");
  const porDiaSemana = bucketBy(rows, (r) => WEEKDAYS[r.scheduledAt.getDay()]);
  const porHorario = bucketBy(rows, (r) => `${String(r.scheduledAt.getHours()).padStart(2, "0")}h`);
  const porRisco = bucketBy(rows, (r) => r.riskLevel);
  const porAntecedencia = bucketBy(rows, (r) => {
    const days = Math.round((r.scheduledAt.getTime() - r.createdAt.getTime()) / 86400000);
    if (days <= 1) return "0-1 dia";
    if (days <= 3) return "2-3 dias";
    if (days <= 7) return "4-7 dias";
    return "> 7 dias";
  });

  const reasons = new Map<string, number>();
  for (const n of noShows) {
    const key = n.noShowReason ?? "outro";
    reasons.set(key, (reasons.get(key) ?? 0) + 1);
  }

  // evolução semanal (últimas 8 semanas)
  const evolution: { week: string; rate: number; total: number; noShow: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekEnd = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekRows = closed.filter((r) => r.scheduledAt >= weekStart && r.scheduledAt < weekEnd);
    const weekNoShow = weekRows.filter((r) => r.status === "no_show").length;
    evolution.push({
      week: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
      total: weekRows.length,
      noShow: weekNoShow,
      rate: weekRows.length ? Math.round((weekNoShow / weekRows.length) * 1000) / 10 : 0,
    });
  }

  return {
    totalNoShow: noShows.length,
    totalFechadas: closed.length,
    taxaNoShow: closed.length ? Math.round((noShows.length / closed.length) * 1000) / 10 : 0,
    taxaComparecimento: closed.length
      ? Math.round(((closed.length - noShows.length) / closed.length) * 1000) / 10
      : 0,
    porSdr,
    porDiaSemana,
    porHorario,
    porRisco,
    porAntecedencia,
    porMotivo: Array.from(reasons.entries()).map(([key, value]) => ({ key, value })),
    evolution,
  };
}

// ---------------------------------------------------------------------------
// REUNIÕES EM RISCO
// ---------------------------------------------------------------------------

export async function getAtRiskMeetings(limit = 20, sdrUserId?: string) {
  const conditions = [
    or(eq(meetings.status, "agendado"), eq(meetings.status, "aguardando_confirmacao"), eq(meetings.status, "em_risco")),
    gte(meetings.scheduledAt, new Date(Date.now() - 1000 * 60 * 60)),
    sdrUserId ? eq(meetings.sdrUserId, sdrUserId) : undefined,
  ].filter(Boolean);

  const rows = await db
    .select({
      meeting: meetings,
      lead: leads,
      sdrName: users.name,
    })
    .from(meetings)
    .innerJoin(leads, eq(meetings.leadId, leads.id))
    .leftJoin(users, eq(meetings.sdrUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(meetings.riskScore), asc(meetings.scheduledAt))
    .limit(limit * 3);

  return rows
    .filter((r) => r.meeting.riskScore >= 31 || r.meeting.scheduledAt.getTime() - Date.now() < 24 * 60 * 60 * 1000)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// TAREFAS
// ---------------------------------------------------------------------------

export async function getTasksForUser(userId?: string) {
  const conditions = [
    eq(tasks.status, "pendente"),
    userId ? eq(tasks.assignedToId, userId) : undefined,
  ].filter(Boolean);

  const rows = await db
    .select({
      task: tasks,
      lead: leads,
      meeting: meetings,
    })
    .from(tasks)
    .leftJoin(leads, eq(tasks.leadId, leads.id))
    .leftJoin(meetings, eq(tasks.meetingId, meetings.id))
    .where(and(...conditions))
    .orderBy(asc(tasks.dueAt));

  const now = Date.now();
  const atrasadas = rows.filter((r) => r.task.dueAt.getTime() < now);
  const prioridadeAlta = rows.filter(
    (r) => r.task.dueAt.getTime() >= now && ["alta", "critica"].includes(r.task.priority)
  );
  const hoje = rows.filter((r) => {
    const d = r.task.dueAt;
    const isToday = d.toDateString() === new Date().toDateString();
    return isToday && d.getTime() >= now && !prioridadeAlta.includes(r);
  });
  const futuras = rows.filter(
    (r) => !atrasadas.includes(r) && !prioridadeAlta.includes(r) && !hoje.includes(r)
  );

  return { all: rows, atrasadas, prioridadeAlta, hoje, futuras };
}

// ---------------------------------------------------------------------------
// PERFORMANCE POR SDR
// ---------------------------------------------------------------------------

export async function getSdrPerformance(sdrUserId: string, range?: DateRange) {
  const conditions = [
    eq(meetings.sdrUserId, sdrUserId),
    range ? gte(meetings.scheduledAt, range.from) : undefined,
    range ? lte(meetings.scheduledAt, range.to) : undefined,
  ].filter(Boolean);

  const rows = await db.select().from(meetings).where(and(...conditions));
  const leadRows = await db.select().from(leads).where(eq(leads.sdrUserId, sdrUserId));

  const contatos = await db
    .select()
    .from(interactions)
    .where(and(eq(interactions.sdrUserId, sdrUserId), ne(interactions.channel, "sistema")));

  const confirmados = rows.filter((r) => ["confirmado", "compareceu", "realizada"].includes(r.status)).length;
  const compareceram = rows.filter((r) => ["compareceu", "realizada"].includes(r.status)).length;
  const noShow = rows.filter((r) => r.status === "no_show").length;
  const remarcacoes = rows.filter((r) => r.status === "remarcado").length;
  const fechadas = compareceram + noShow;
  const recuperadas = rows.filter((r) => r.recoveryStage === "recuperado").length;
  const tentativasRecuperacao = rows.filter((r) => r.recoveryAttempts > 0).length;

  // tempo médio até o primeiro contato
  let totalMinutes = 0;
  let countedMeetings = 0;
  for (const m of rows) {
    const firstContact = contatos
      .filter((c) => c.leadId === m.leadId && c.createdAt >= m.createdAt)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    if (firstContact) {
      totalMinutes += (firstContact.createdAt.getTime() - m.createdAt.getTime()) / 60000;
      countedMeetings++;
    }
  }

  return {
    selfBookingsRecebidos: rows.length,
    leadsTrabalhados: leadRows.length,
    contatosRealizados: contatos.length,
    confirmacoes: confirmados,
    comparecimentos: compareceram,
    noShows: noShow,
    remarcacoes,
    taxaConfirmacao: rows.length ? Math.round((confirmados / rows.length) * 1000) / 10 : 0,
    taxaComparecimento: fechadas ? Math.round((compareceram / fechadas) * 1000) / 10 : 0,
    taxaNoShow: fechadas ? Math.round((noShow / fechadas) * 1000) / 10 : 0,
    tempoMedioPrimeiroContatoMin: countedMeetings ? Math.round(totalMinutes / countedMeetings) : null,
    tentativasMediasPorLead: leadRows.length ? Math.round((contatos.length / leadRows.length) * 10) / 10 : 0,
    taxaRecuperacao: tentativasRecuperacao ? Math.round((recuperadas / tentativasRecuperacao) * 1000) / 10 : 0,
  };
}

// ---------------------------------------------------------------------------
// INSIGHTS (calculados a partir dos dados reais)
// ---------------------------------------------------------------------------

export async function getInsights() {
  const rows = await db
    .select({ id: meetings.id, leadId: meetings.leadId, status: meetings.status, scheduledAt: meetings.scheduledAt, createdAt: meetings.createdAt })
    .from(meetings)
    .where(or(eq(meetings.status, "no_show"), eq(meetings.status, "compareceu"), eq(meetings.status, "realizada")));

  const allInteractions = await db.select().from(interactions);

  const insights: string[] = [];

  // Insight 1: resposta ao primeiro contato x no-show
  const leadsComRespostaInicial = new Set(
    allInteractions.filter((i) => ["respondeu", "confirmou"].includes(i.result)).map((i) => i.leadId)
  );
  const comResposta = rows.filter((r) => leadsComRespostaInicial.has(r.leadId));
  const semResposta = rows.filter((r) => !leadsComRespostaInicial.has(r.leadId));
  const taxaComResposta = comResposta.length
    ? comResposta.filter((r) => r.status === "no_show").length / comResposta.length
    : 0;
  const taxaSemResposta = semResposta.length
    ? semResposta.filter((r) => r.status === "no_show").length / semResposta.length
    : 0;
  if (comResposta.length >= 3 && semResposta.length >= 3 && taxaComResposta > 0) {
    const multiplicador = Math.round((taxaSemResposta / taxaComResposta) * 10) / 10;
    if (multiplicador > 1) {
      insights.push(
        `Leads que não respondem ao primeiro contato possuem ${multiplicador}x mais chance de no-show do que os que respondem.`
      );
    }
  } else if (semResposta.length >= 3 && taxaSemResposta > 0 && comResposta.length < 3) {
    insights.push(
      `Leads que não respondem ao primeiro contato têm taxa de no-show de ${Math.round(taxaSemResposta * 1000) / 10}%.`
    );
  }

  // Insight 2: antecedência de agendamento x no-show
  const comAntecedencia = rows.filter(
    (r) => (r.scheduledAt.getTime() - r.createdAt.getTime()) / 86400000 > 7
  );
  const semAntecedencia = rows.filter(
    (r) => (r.scheduledAt.getTime() - r.createdAt.getTime()) / 86400000 <= 7
  );
  if (comAntecedencia.length >= 3 && semAntecedencia.length >= 3) {
    const taxaCom = comAntecedencia.filter((r) => r.status === "no_show").length / comAntecedencia.length;
    const taxaSem = semAntecedencia.filter((r) => r.status === "no_show").length / semAntecedencia.length;
    if (taxaCom > taxaSem) {
      insights.push(
        `Reuniões agendadas com mais de 7 dias de antecedência apresentam taxa de no-show de ${Math.round(taxaCom * 1000) / 10}%, contra ${Math.round(taxaSem * 1000) / 10}% nas demais.`
      );
    }
  }

  // Insight 3: número de interações x comparecimento
  const interactionCountByLead = new Map<string, number>();
  for (const i of allInteractions) {
    if (i.channel === "sistema") continue;
    interactionCountByLead.set(i.leadId, (interactionCountByLead.get(i.leadId) ?? 0) + 1);
  }
  const comMuitasInteracoes = rows.filter((r) => (interactionCountByLead.get(r.leadId) ?? 0) >= 2);
  const comPoucasInteracoes = rows.filter((r) => (interactionCountByLead.get(r.leadId) ?? 0) < 2);
  if (comMuitasInteracoes.length >= 3 && comPoucasInteracoes.length >= 3) {
    const compCom = comMuitasInteracoes.filter((r) => ["compareceu", "realizada"].includes(r.status)).length / comMuitasInteracoes.length;
    const compSem = comPoucasInteracoes.filter((r) => ["compareceu", "realizada"].includes(r.status)).length / comPoucasInteracoes.length;
    if (compCom > compSem) {
      insights.push(
        `Leads com 2 ou mais interações antes da reunião comparecem ${Math.round(compCom * 1000) / 10}% das vezes, contra ${Math.round(compSem * 1000) / 10}% com apenas uma interação ou nenhuma.`
      );
    }
  }

  if (insights.length === 0) {
    insights.push(
      "Ainda não há dados suficientes para gerar insights estatisticamente relevantes. Continue registrando interações e resultados para desbloquear esta análise."
    );
  }

  return insights;
}
