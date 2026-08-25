"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { meetings, leads, interactions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { recalculateMeetingRisk } from "@/lib/risk-score";
import { createRecoveryTask } from "@/lib/tasks";
import { notify } from "@/lib/notifications";

async function assertCanAct(meetingId: string) {
  const user = await requireUser();
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
  if (!meeting) throw new Error("Reunião não encontrada");
  if (user.role === "sdr" && meeting.sdrUserId !== user.id) {
    throw new Error("Você não tem permissão para alterar esta reunião");
  }
  return { user, meeting };
}

export async function confirmMeetingAction(meetingId: string) {
  const { user, meeting } = await assertCanAct(meetingId);

  await db
    .update(meetings)
    .set({ status: "confirmado", confirmedAt: new Date(), updatedAt: new Date() })
    .where(eq(meetings.id, meetingId));

  await db.insert(interactions).values({
    leadId: meeting.leadId,
    meetingId,
    sdrUserId: user.id,
    channel: "sistema",
    type: "Reunião confirmada",
    result: "confirmou",
  });

  await recalculateMeetingRisk(meetingId);
  await logAudit({ userId: user.id, action: "reuniao_confirmada", entityType: "meeting", entityId: meetingId });
  revalidatePath("/", "layout");
}

export async function markUnconfirmedAction(meetingId: string) {
  const { user, meeting } = await assertCanAct(meetingId);

  await db
    .update(meetings)
    .set({ status: "aguardando_confirmacao", confirmedAt: null, updatedAt: new Date() })
    .where(eq(meetings.id, meetingId));

  await db.insert(interactions).values({
    leadId: meeting.leadId,
    meetingId,
    sdrUserId: user.id,
    channel: "sistema",
    type: "Marcado como não confirmado",
    result: "sem_resposta",
  });

  await recalculateMeetingRisk(meetingId);
  await logAudit({ userId: user.id, action: "reuniao_nao_confirmada", entityType: "meeting", entityId: meetingId });
  revalidatePath("/", "layout");
}

export async function rescheduleMeetingAction(meetingId: string, newDateISO: string) {
  const { user, meeting } = await assertCanAct(meetingId);
  const newDate = new Date(newDateISO);
  if (Number.isNaN(newDate.getTime())) throw new Error("Data inválida");

  await db
    .update(meetings)
    .set({ scheduledAt: newDate, status: "aguardando_confirmacao", updatedAt: new Date() })
    .where(eq(meetings.id, meetingId));

  await db.insert(interactions).values({
    leadId: meeting.leadId,
    meetingId,
    sdrUserId: user.id,
    channel: "sistema",
    type: "Reunião remarcada manualmente",
    result: "pediu_remarcar",
    note: `De ${meeting.scheduledAt.toLocaleString("pt-BR")} para ${newDate.toLocaleString("pt-BR")}`,
  });

  await recalculateMeetingRisk(meetingId);
  await logAudit({
    userId: user.id,
    action: "reuniao_remarcada",
    entityType: "meeting",
    entityId: meetingId,
    before: { scheduledAt: meeting.scheduledAt },
    after: { scheduledAt: newDate },
  });
  revalidatePath("/", "layout");
}

export async function cancelMeetingAction(meetingId: string, reason: string) {
  const { user, meeting } = await assertCanAct(meetingId);

  await db
    .update(meetings)
    .set({
      status: "cancelado",
      canceledAt: new Date(),
      cancelReason: reason || "Não informado",
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, meetingId));

  await db.insert(interactions).values({
    leadId: meeting.leadId,
    meetingId,
    sdrUserId: user.id,
    channel: "sistema",
    type: "Reunião cancelada",
    result: "cancelou",
    note: reason,
  });

  await createRecoveryTask({
    leadId: meeting.leadId,
    meetingId,
    assignedToId: meeting.sdrUserId,
    reason: "cancelamento",
  });

  await notify({
    userId: meeting.sdrUserId,
    type: "lead_cancelou",
    title: "Reunião cancelada",
    message: "Uma reunião foi cancelada — tarefa de recuperação criada.",
    relatedEntityType: "meeting",
    relatedEntityId: meetingId,
  });

  await logAudit({ userId: user.id, action: "reuniao_cancelada", entityType: "meeting", entityId: meetingId, after: { reason } });
  revalidatePath("/", "layout");
}

export async function markAttendedAction(meetingId: string) {
  const { user, meeting } = await assertCanAct(meetingId);

  await db
    .update(meetings)
    .set({ status: "compareceu", attendedAt: new Date(), updatedAt: new Date() })
    .where(eq(meetings.id, meetingId));

  await db.insert(interactions).values({
    leadId: meeting.leadId,
    meetingId,
    sdrUserId: user.id,
    channel: "sistema",
    type: "Compareceu à reunião",
    result: "confirmou",
  });

  await db.update(leads).set({ status: "oportunidade", updatedAt: new Date() }).where(eq(leads.id, meeting.leadId));

  await recalculateMeetingRisk(meetingId);
  await logAudit({ userId: user.id, action: "reuniao_compareceu", entityType: "meeting", entityId: meetingId });
  revalidatePath("/", "layout");
}

export async function markNoShowAction(
  meetingId: string,
  reason: string,
  note?: string
) {
  const { user, meeting } = await assertCanAct(meetingId);

  await db
    .update(meetings)
    .set({
      status: "no_show",
      noShowAt: new Date(),
      noShowReason: reason as never,
      noShowReasonNote: note,
      recoveryStage: "contato_imediato",
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, meetingId));

  await db.insert(interactions).values({
    leadId: meeting.leadId,
    meetingId,
    sdrUserId: user.id,
    channel: "sistema",
    type: "No-show registrado",
    result: "cancelou",
    note: `Motivo: ${reason}${note ? " — " + note : ""}`,
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
    message: "Tarefa de recuperação criada automaticamente.",
    relatedEntityType: "meeting",
    relatedEntityId: meetingId,
  });

  await recalculateMeetingRisk(meetingId);
  await logAudit({ userId: user.id, action: "no_show_registrado", entityType: "meeting", entityId: meetingId, after: { reason, note } });
  revalidatePath("/", "layout");
}

export async function advanceRecoveryStageAction(meetingId: string, note?: string) {
  const { user, meeting } = await assertCanAct(meetingId);
  const order = ["nenhuma", "contato_imediato", "nova_tentativa", "follow_up", "encerrado_perdido"] as const;
  const idx = order.indexOf(meeting.recoveryStage as (typeof order)[number]);
  const nextStage = order[Math.min(idx + 1, order.length - 1)];

  await db
    .update(meetings)
    .set({
      recoveryStage: nextStage,
      recoveryAttempts: meeting.recoveryAttempts + 1,
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, meetingId));

  await db.insert(interactions).values({
    leadId: meeting.leadId,
    meetingId,
    sdrUserId: user.id,
    channel: "whatsapp",
    type: "Tentativa de recuperação",
    result: "sem_resposta",
    note,
  });

  await logAudit({ userId: user.id, action: "recuperacao_avancada", entityType: "meeting", entityId: meetingId, after: { nextStage } });
  revalidatePath("/", "layout");
}

export async function markRecoveredAction(meetingId: string) {
  const { user, meeting } = await assertCanAct(meetingId);
  await db
    .update(meetings)
    .set({ recoveryStage: "recuperado", updatedAt: new Date() })
    .where(eq(meetings.id, meetingId));

  await db.insert(interactions).values({
    leadId: meeting.leadId,
    meetingId,
    sdrUserId: user.id,
    channel: "sistema",
    type: "Lead recuperado",
    result: "confirmou",
  });

  await logAudit({ userId: user.id, action: "lead_recuperado", entityType: "meeting", entityId: meetingId });
  revalidatePath("/", "layout");
}
