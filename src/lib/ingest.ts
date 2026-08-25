import { db } from "@/db";
import { leads, meetings, interactions, selfBookingRules, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  matchesSelfBookingRules,
  extractLeadAttendee,
  type NormalizedCalendarEvent,
} from "@/lib/self-booking-rules";
import { recalculateMeetingRisk } from "@/lib/risk-score";
import { createCadenceTasksForMeeting, createRecoveryTask } from "@/lib/tasks";
import { notify } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";

const INTERNAL_DOMAINS = ["grupotrivion.com", "trivion.com"];

export type IngestResult = {
  outcome: "criado" | "atualizado" | "remarcado" | "cancelado" | "ignorado";
  meetingId?: string;
  leadId?: string;
};

/**
 * Processa um evento normalizado do Google Calendar (vindo do sync real ou
 * do simulador) e aplica as regras de negócio: identifica Self Booking,
 * cria/atualiza lead e reunião sem duplicar, calcula risco, cria tarefas e
 * notifica o SDR responsável.
 */
export async function ingestCalendarEvent(
  event: NormalizedCalendarEvent,
  calendarSourceId: string,
  sdrUserId: string | null
): Promise<IngestResult> {
  const rules = await db.select().from(selfBookingRules);
  if (!matchesSelfBookingRules(event, calendarSourceId, rules)) {
    return { outcome: "ignorado" };
  }

  const [existingMeeting] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.googleEventId, event.googleEventId))
    .limit(1);

  // --- Evento cancelado no Google Calendar -------------------------------
  if (event.isCancelled) {
    if (!existingMeeting) return { outcome: "ignorado" };
    if (existingMeeting.status === "cancelado") {
      return { outcome: "cancelado", meetingId: existingMeeting.id };
    }
    await db
      .update(meetings)
      .set({
        status: "cancelado",
        canceledAt: new Date(),
        cancelReason: existingMeeting.cancelReason ?? "Cancelado no Google Calendar",
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, existingMeeting.id));

    await db.insert(interactions).values({
      leadId: existingMeeting.leadId,
      meetingId: existingMeeting.id,
      sdrUserId: existingMeeting.sdrUserId,
      channel: "sistema",
      type: "Cancelamento detectado no Google Calendar",
      result: "cancelou",
    });

    await createRecoveryTask({
      leadId: existingMeeting.leadId,
      meetingId: existingMeeting.id,
      assignedToId: existingMeeting.sdrUserId,
      reason: "cancelamento",
    });

    await notify({
      userId: existingMeeting.sdrUserId,
      type: "lead_cancelou",
      title: "Reunião cancelada",
      message: `Uma reunião foi cancelada no Google Calendar.`,
      relatedEntityType: "meeting",
      relatedEntityId: existingMeeting.id,
    });

    await logAudit({
      action: "meeting_cancelado_via_sync",
      entityType: "meeting",
      entityId: existingMeeting.id,
      before: existingMeeting,
    });

    return { outcome: "cancelado", meetingId: existingMeeting.id };
  }

  // --- Identifica o lead (participante externo) ---------------------------
  const attendee = extractLeadAttendee(event, INTERNAL_DOMAINS);
  const leadEmail = attendee?.email?.toLowerCase() ?? null;
  const leadName = attendee?.name || leadEmail?.split("@")[0] || "Lead sem nome";

  let lead;
  if (leadEmail) {
    const [found] = await db
      .select()
      .from(leads)
      .where(eq(leads.email, leadEmail))
      .limit(1);
    lead = found;
  }

  if (!lead) {
    const [created] = await db
      .insert(leads)
      .values({
        name: leadName,
        email: leadEmail,
        source: "self_booking",
        sdrUserId,
        status: "reuniao_marcada",
      })
      .returning();
    lead = created;

    await logAudit({
      action: "lead_criado_via_sync",
      entityType: "lead",
      entityId: lead.id,
      after: lead,
    });
  }

  // --- Cria ou atualiza a reunião (evita duplicidade por googleEventId) --
  if (existingMeeting) {
    const dateChanged =
      existingMeeting.scheduledAt.getTime() !== event.start.getTime();

    const [updated] = await db
      .update(meetings)
      .set({
        scheduledAt: event.start,
        durationMinutes: Math.max(
          15,
          Math.round((event.end.getTime() - event.start.getTime()) / 60000)
        ),
        meetingLink: event.meetingLink ?? existingMeeting.meetingLink,
        rawTitle: event.title,
        rawDescription: event.description ?? existingMeeting.rawDescription,
        status: dateChanged ? "remarcado" : existingMeeting.status,
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, existingMeeting.id))
      .returning();

    if (dateChanged) {
      await db.insert(interactions).values({
        leadId: existingMeeting.leadId,
        meetingId: existingMeeting.id,
        sdrUserId: existingMeeting.sdrUserId,
        channel: "sistema",
        type: "Remarcação detectada no Google Calendar",
        result: "pediu_remarcar",
        note: `De ${existingMeeting.scheduledAt.toISOString()} para ${event.start.toISOString()}`,
      });

      // volta para aguardando confirmação, preservando o histórico anterior
      await db
        .update(meetings)
        .set({ status: "aguardando_confirmacao" })
        .where(eq(meetings.id, existingMeeting.id));

      await notify({
        userId: existingMeeting.sdrUserId,
        type: "outro",
        title: "Reunião remarcada",
        message: `${lead.name} remarcou a reunião.`,
        relatedEntityType: "meeting",
        relatedEntityId: existingMeeting.id,
      });
    }

    await recalculateMeetingRisk(existingMeeting.id);

    await logAudit({
      action: dateChanged ? "meeting_remarcada_via_sync" : "meeting_atualizada_via_sync",
      entityType: "meeting",
      entityId: existingMeeting.id,
      before: existingMeeting,
      after: updated,
    });

    return {
      outcome: dateChanged ? "remarcado" : "atualizado",
      meetingId: existingMeeting.id,
      leadId: lead.id,
    };
  }

  // Novo evento => nova reunião
  const [newMeeting] = await db
    .insert(meetings)
    .values({
      leadId: lead.id,
      googleEventId: event.googleEventId,
      calendarSourceId,
      scheduledAt: event.start,
      durationMinutes: Math.max(
        15,
        Math.round((event.end.getTime() - event.start.getTime()) / 60000)
      ),
      sdrUserId,
      meetingType: "self_booking",
      status: "agendado",
      meetingLink: event.meetingLink,
      rawTitle: event.title,
      rawDescription: event.description,
    })
    .onConflictDoNothing({ target: meetings.googleEventId })
    .returning();

  // onConflictDoNothing pode retornar vazio se outra chamada concorrente já criou
  if (!newMeeting) {
    const [found] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.googleEventId, event.googleEventId))
      .limit(1);
    return { outcome: "atualizado", meetingId: found?.id, leadId: lead.id };
  }

  await db.insert(interactions).values({
    leadId: lead.id,
    meetingId: newMeeting.id,
    sdrUserId,
    channel: "sistema",
    type: "Self Booking realizado",
    result: "neutro",
    note: `Reunião agendada automaticamente via Google Calendar (${event.calendarSourceLabel ?? "agenda monitorada"}).`,
  });

  await createCadenceTasksForMeeting(newMeeting.id);
  await recalculateMeetingRisk(newMeeting.id);

  const [sdr] = sdrUserId
    ? await db.select().from(users).where(eq(users.id, sdrUserId)).limit(1)
    : [null];

  await notify({
    userId: sdrUserId,
    type: "novo_self_booking",
    title: "Novo Self Booking",
    message: `${lead.name}${lead.company ? " · " + lead.company : ""} agendou uma reunião.`,
    relatedEntityType: "meeting",
    relatedEntityId: newMeeting.id,
  });

  await logAudit({
    action: "self_booking_criado",
    entityType: "meeting",
    entityId: newMeeting.id,
    after: newMeeting,
  });

  return { outcome: "criado", meetingId: newMeeting.id, leadId: lead.id };
}
