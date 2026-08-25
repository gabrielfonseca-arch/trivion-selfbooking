import { db } from "@/db";
import {
  meetings,
  leads,
  interactions,
  riskFactors,
  riskThresholds,
} from "@/db/schema";
import { eq, and, ne, desc, lt } from "drizzle-orm";

/**
 * Fatores padrão do algoritmo de Score de Risco de No-show (0-100).
 * Podem ser editados em Configurações → Score de Risco (tabela risk_factors).
 */
export const DEFAULT_RISK_FACTORS = [
  { key: "sem_resposta_nenhuma", label: "Lead não respondeu nenhuma mensagem", points: 20, order: 1 },
  { key: "sem_confirmacao_24h", label: "Reunião em menos de 24 horas sem confirmação", points: 20, order: 2 },
  { key: "no_show_anterior", label: "Lead já deu no-show anteriormente", points: 15, order: 3 },
  { key: "ja_remarcou", label: "Lead já remarcou", points: 10, order: 4 },
  { key: "agendamento_antecedencia", label: "Agendamento feito com muita antecedência (>7 dias)", points: 10, order: 5 },
  { key: "info_incompleta", label: "Lead não informou informações importantes", points: 10, order: 6 },
  { key: "sem_resposta_lembrete", label: "Não respondeu ao lembrete", points: 5, order: 7 },
  { key: "confirmou_explicitamente", label: "Lead confirmou explicitamente", points: -20, order: 8 },
  { key: "respondeu_ao_sdr", label: "Lead respondeu ao SDR", points: -15, order: 9 },
  { key: "interagiu_proximo_horario", label: "Lead interagiu próximo ao horário", points: -10, order: 10 },
  { key: "confirmou_participacao", label: "Lead confirmou participação", points: -10, order: 11 },
] as const;

export async function ensureDefaultRiskConfig() {
  const existingFactors = await db.select().from(riskFactors).limit(1);
  if (existingFactors.length === 0) {
    await db.insert(riskFactors).values(
      DEFAULT_RISK_FACTORS.map((f) => ({
        key: f.key,
        label: f.label,
        points: f.points,
        order: f.order,
        active: true,
      }))
    );
  }
  const existingThresholds = await db.select().from(riskThresholds).limit(1);
  if (existingThresholds.length === 0) {
    await db.insert(riskThresholds).values({ lowMax: 30, mediumMax: 60 });
  }
}

export function classifyRisk(
  score: number,
  thresholds: { lowMax: number; mediumMax: number }
): "baixo" | "medio" | "alto" {
  if (score <= thresholds.lowMax) return "baixo";
  if (score <= thresholds.mediumMax) return "medio";
  return "alto";
}

/**
 * Recalcula o score de risco de uma reunião com base no estado atual do
 * lead, das interações registradas e do tempo até o horário da reunião.
 * Atualiza `meetings.riskScore/riskLevel` e `leads.riskScore/riskLevel`.
 */
export async function recalculateMeetingRisk(meetingId: string) {
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);
  if (!meeting) return null;

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, meeting.leadId))
    .limit(1);
  if (!lead) return null;

  const leadInteractions = await db
    .select()
    .from(interactions)
    .where(eq(interactions.leadId, lead.id))
    .orderBy(desc(interactions.createdAt));

  const pastMeetings = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.leadId, lead.id), ne(meetings.id, meeting.id)));

  const now = new Date();
  const hoursToMeeting =
    (meeting.scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  const daysAntecedencia =
    (meeting.scheduledAt.getTime() - meeting.createdAt.getTime()) /
    (1000 * 60 * 60 * 24);

  const hasAnyResponse = leadInteractions.some((i) =>
    ["respondeu", "confirmou"].includes(i.result)
  );
  const lastReminder = leadInteractions.find((i) => i.type
    .toLowerCase()
    .includes("lembrete"));
  const respondedNearMeeting = leadInteractions.some(
    (i) =>
      ["respondeu", "confirmou"].includes(i.result) &&
      Math.abs(meeting.scheduledAt.getTime() - i.createdAt.getTime()) <
        1000 * 60 * 60 * 6
  );
  const confirmedRecently = leadInteractions.some(
    (i) => i.result === "confirmou"
  );

  const flags: Record<string, boolean> = {
    sem_resposta_nenhuma: !hasAnyResponse && leadInteractions.length > 0,
    sem_confirmacao_24h:
      hoursToMeeting <= 24 &&
      hoursToMeeting >= 0 &&
      meeting.status !== "confirmado",
    no_show_anterior: pastMeetings.some((m) => m.status === "no_show"),
    ja_remarcou:
      pastMeetings.some((m) => m.status === "remarcado") ||
      Boolean(meeting.rescheduledFromId),
    agendamento_antecedencia: daysAntecedencia > 7,
    info_incompleta: !lead.company || !(lead.phone || lead.whatsapp),
    sem_resposta_lembrete: Boolean(lastReminder) && lastReminder!.result === "sem_resposta",
    confirmou_explicitamente: meeting.status === "confirmado",
    respondeu_ao_sdr: hasAnyResponse,
    interagiu_proximo_horario: respondedNearMeeting,
    confirmou_participacao: confirmedRecently,
  };

  const activeFactors = await db
    .select()
    .from(riskFactors)
    .where(eq(riskFactors.active, true));

  let score = 0;
  for (const factor of activeFactors) {
    if (flags[factor.key]) score += factor.points;
  }
  score = Math.max(0, Math.min(100, score));

  const [thresholds] = await db.select().from(riskThresholds).limit(1);
  const level = classifyRisk(
    score,
    thresholds ?? { lowMax: 30, mediumMax: 60 }
  );

  await db
    .update(meetings)
    .set({ riskScore: score, riskLevel: level, updatedAt: new Date() })
    .where(eq(meetings.id, meeting.id));

  // Reflete no lead o risco da sua próxima reunião ativa mais relevante
  await db
    .update(leads)
    .set({ riskScore: score, riskLevel: level, updatedAt: new Date() })
    .where(eq(leads.id, lead.id));

  return { score, level, flags };
}

/** Prioridade textual para a seção "Reuniões em risco". */
export function meetingUrgency(meeting: {
  scheduledAt: Date;
  riskScore: number;
  status: string;
}): { level: "critico" | "alto" | "medio" | "baixo"; label: string } {
  const hoursToMeeting =
    (meeting.scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);

  if (
    hoursToMeeting <= 24 &&
    hoursToMeeting >= 0 &&
    meeting.status !== "confirmado" &&
    meeting.riskScore >= 60
  ) {
    return { level: "critico", label: "CRÍTICO" };
  }
  if (meeting.riskScore >= 61) {
    return { level: "alto", label: "ALTO" };
  }
  if (meeting.riskScore >= 31) {
    return { level: "medio", label: "MÉDIO" };
  }
  return { level: "baixo", label: "BAIXO" };
}
