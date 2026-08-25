import { eq } from "drizzle-orm";
import { db } from "@/db";
import { meetings, leads, interactions } from "@/db/schema";
import { recalculateMeetingRisk } from "@/lib/risk-score";
import { createRecoveryTask } from "@/lib/tasks";
import { notify } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";

/**
 * Marcadores de cor do Google Calendar, definidos manualmente pelo closer no
 * próprio evento, e o que cada um deve atualizar automaticamente no sistema:
 *  - Grafite (cinza, colorId "8"): cliente confirmou presença -> "confirmado"
 *  - Manjericão (verde, colorId "10"): reunião foi realizada -> "realizada"
 *  - Banana (amarelo, colorId "5"): no-show -> "no_show"
 *
 * IDs de cor conforme a Google Calendar API (calendar.colors.get / eventColors):
 * 1 Lavanda, 2 Sálvia, 3 Uva, 4 Flamingo, 5 Banana, 6 Tangerina, 7 Pavão,
 * 8 Grafite, 9 Mirtilo, 10 Manjericão, 11 Tomate.
 */
export const EVENT_COLOR_STATUS_MAP: Record<string, "confirmado" | "realizada" | "no_show"> = {
  "8": "confirmado",
  "10": "realizada",
  "5": "no_show",
};

const TERMINAL_STATUSES = ["cancelado", "no_show", "compareceu", "realizada"];

/**
 * Aplica o status derivado da cor do evento (ver EVENT_COLOR_STATUS_MAP) à
 * reunião recém-sincronizada. Idempotente: não repete efeitos colaterais
 * (tarefa de recuperação, notificação) se a reunião já estiver nesse status.
 */
export async function applyEventColorStatus(meetingId: string, colorId?: string | null) {
  if (!colorId) return;
  const target = EVENT_COLOR_STATUS_MAP[colorId];
  if (!target) return;

  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
  if (!meeting) return;
  if (meeting.status === target) return;
  // Não sobrescreve um status terminal já registrado manualmente (ex: já cancelado).
  if (TERMINAL_STATUSES.includes(meeting.status) && meeting.status !== target) return;

  const now = new Date();

  if (target === "confirmado") {
    await db
      .update(meetings)
      .set({ status: "confirmado", confirmedAt: now, updatedAt: now })
      .where(eq(meetings.id, meetingId));
    await db.insert(interactions).values({
      leadId: meeting.leadId,
      meetingId,
      channel: "sistema",
      type: "Confirmação detectada pela cor do evento no Google Calendar",
      result: "confirmou",
    });
  } else if (target === "realizada") {
    await db
      .update(meetings)
      .set({ status: "realizada", attendedAt: now, updatedAt: now })
      .where(eq(meetings.id, meetingId));
    await db.insert(interactions).values({
      leadId: meeting.leadId,
      meetingId,
      channel: "sistema",
      type: "Reunião realizada — detectado pela cor do evento no Google Calendar",
      result: "confirmou",
    });
    await db.update(leads).set({ status: "oportunidade", updatedAt: now }).where(eq(leads.id, meeting.leadId));
  } else if (target === "no_show") {
    await db
      .update(meetings)
      .set({
        status: "no_show",
        noShowAt: now,
        noShowReason: meeting.noShowReason ?? "outro",
        noShowReasonNote:
          meeting.noShowReasonNote ?? "Detectado automaticamente pela cor do evento no Google Calendar (amarelo).",
        recoveryStage: "contato_imediato",
        updatedAt: now,
      })
      .where(eq(meetings.id, meetingId));
    await db.insert(interactions).values({
      leadId: meeting.leadId,
      meetingId,
      channel: "sistema",
      type: "No-show detectado pela cor do evento no Google Calendar",
      result: "cancelou",
    });
    await createRecoveryTask({
      leadId: meeting.leadId,
      meetingId,
      assignedToId: meeting.sdrUserId,
      reason: "no_show",
    });
    await notify({
      userId: meeting.sdrUserId,
      type: "lead_no_show",
      title: "No-show registrado",
      message: "Detectado automaticamente pela cor do evento na agenda. Tarefa de recuperação criada.",
      relatedEntityType: "meeting",
      relatedEntityId: meetingId,
    });
  }

  await recalculateMeetingRisk(meetingId);
  await logAudit({
    action: "meeting_status_atualizado_por_cor",
    entityType: "meeting",
    entityId: meetingId,
    before: { status: meeting.status },
    after: { status: target, colorId },
  });
}
