"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarSources } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getGoogleAuthUrl, isGoogleConfigured, syncAllCalendarSources, disconnectGoogleAccount } from "@/lib/google-calendar";
import { simulateNewSelfBooking, simulateReschedule, simulateCancellation, simulateDuplicateSync } from "@/lib/calendar-simulator";
import { meetings } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function startGoogleConnectAction() {
  await requireRole(["admin"]);
  if (!isGoogleConfigured()) {
    throw new Error(
      "Credenciais do Google não configuradas. Preencha GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env (veja o README)."
    );
  }
  redirect(getGoogleAuthUrl());
}

export async function disconnectGoogleAction() {
  const admin = await requireRole(["admin"]);
  await disconnectGoogleAccount();
  await logAudit({ userId: admin.id, action: "google_desconectado", entityType: "google_integration" });
  revalidatePath("/settings/integrations");
}

export async function addCalendarSourceAction(formData: FormData) {
  const admin = await requireRole(["admin"]);
  const label = String(formData.get("label") || "");
  const calendarId = String(formData.get("calendarId") || "").toLowerCase().trim();
  const sdrUserId = (formData.get("sdrUserId") as string) || null;
  if (!label || !calendarId) throw new Error("Preencha nome e e-mail/ID da agenda");

  const [created] = await db.insert(calendarSources).values({ label, calendarId, sdrUserId }).returning();
  await logAudit({ userId: admin.id, action: "agenda_adicionada", entityType: "calendar_source", entityId: created.id, after: { label, calendarId } });
  revalidatePath("/settings/integrations");
}

export async function toggleCalendarSourceAction(id: string) {
  const admin = await requireRole(["admin"]);
  const [source] = await db.select().from(calendarSources).where(eq(calendarSources.id, id)).limit(1);
  if (!source) return;
  await db.update(calendarSources).set({ active: !source.active }).where(eq(calendarSources.id, id));
  await logAudit({ userId: admin.id, action: "agenda_alterada", entityType: "calendar_source", entityId: id, after: { active: !source.active } });
  revalidatePath("/settings/integrations");
}

export async function runRealSyncAction() {
  const admin = await requireRole(["admin", "coordinator"]);
  const summary = await syncAllCalendarSources();
  await logAudit({ userId: admin.id, action: "sync_google_executado", entityType: "google_integration", after: summary });
  revalidatePath("/", "layout");
  return summary;
}

// ---------------------------------------------------------------------------
// SIMULADOR (usado enquanto não há credenciais reais do Google)
// ---------------------------------------------------------------------------

async function getOrCreateSimulatedSource(sdrUserId: string | null) {
  const [existing] = await db
    .select()
    .from(calendarSources)
    .where(eq(calendarSources.label, "João Gabriel - Closer (simulado)"))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(calendarSources)
    .values({
      label: "João Gabriel - Closer (simulado)",
      calendarId: "joao.gabriel@grupotrivion.com",
      sdrUserId,
      active: true,
    })
    .returning();
  return created;
}

export async function simulateNewBookingAction(sdrUserId: string, hoursFromNow: number) {
  const admin = await requireRole(["admin", "coordinator"]);
  const source = await getOrCreateSimulatedSource(sdrUserId);
  const result = await simulateNewSelfBooking({
    calendarSourceId: source.id,
    sdrUserId,
    scheduledAt: new Date(Date.now() + hoursFromNow * 60 * 60 * 1000),
  });
  await logAudit({ userId: admin.id, action: "sync_simulado_novo_booking", entityType: "meeting", entityId: result.meetingId });
  revalidatePath("/", "layout");
  return result;
}

export async function simulateRescheduleLatestAction() {
  const admin = await requireRole(["admin", "coordinator"]);
  const [latest] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.meetingType, "self_booking"))
    .orderBy(desc(meetings.createdAt))
    .limit(1);
  if (!latest) throw new Error("Nenhuma reunião simulada encontrada. Crie uma primeiro.");
  const result = await simulateReschedule(latest.id, new Date(Date.now() + 48 * 60 * 60 * 1000));
  await logAudit({ userId: admin.id, action: "sync_simulado_remarcacao", entityType: "meeting", entityId: latest.id });
  revalidatePath("/", "layout");
  return result;
}

export async function simulateCancellationLatestAction() {
  const admin = await requireRole(["admin", "coordinator"]);
  const [latest] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.meetingType, "self_booking"))
    .orderBy(desc(meetings.createdAt))
    .limit(1);
  if (!latest) throw new Error("Nenhuma reunião simulada encontrada. Crie uma primeiro.");
  const result = await simulateCancellation(latest.id);
  await logAudit({ userId: admin.id, action: "sync_simulado_cancelamento", entityType: "meeting", entityId: latest.id });
  revalidatePath("/", "layout");
  return result;
}

export async function simulateDuplicateLatestAction() {
  const admin = await requireRole(["admin", "coordinator"]);
  const [latest] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.meetingType, "self_booking"))
    .orderBy(desc(meetings.createdAt))
    .limit(1);
  if (!latest) throw new Error("Nenhuma reunião simulada encontrada. Crie uma primeiro.");
  const before = await db.select().from(meetings);
  const result = await simulateDuplicateSync(latest.id);
  const after = await db.select().from(meetings);
  await logAudit({
    userId: admin.id,
    action: "sync_simulado_duplicidade_testada",
    entityType: "meeting",
    entityId: latest.id,
    after: { totalAntes: before.length, totalDepois: after.length },
  });
  revalidatePath("/", "layout");
  return { ...result, totalAntes: before.length, totalDepois: after.length };
}
