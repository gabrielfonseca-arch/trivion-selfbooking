"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interactions, leads } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { recalculateMeetingRisk } from "@/lib/risk-score";
import { meetings } from "@/db/schema";

export async function registerInteractionAction(formData: FormData) {
  const user = await requireUser();
  const leadId = String(formData.get("leadId") || "");
  const meetingId = (formData.get("meetingId") as string) || null;
  const channel = String(formData.get("channel") || "sistema");
  const type = String(formData.get("type") || "Interação");
  const result = String(formData.get("result") || "neutro");
  const note = (formData.get("note") as string) || undefined;

  if (!leadId) throw new Error("Lead inválido");

  await db.insert(interactions).values({
    leadId,
    meetingId,
    sdrUserId: user.id,
    channel: channel as never,
    type,
    result: result as never,
    note,
  });

  await db.update(leads).set({ lastContactAt: new Date(), updatedAt: new Date() }).where(eq(leads.id, leadId));

  // se houver uma reunião associada, recalcula o risco
  if (meetingId) {
    await recalculateMeetingRisk(meetingId);
  } else {
    const [nextMeeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.leadId, leadId))
      .limit(1);
    if (nextMeeting) await recalculateMeetingRisk(nextMeeting.id);
  }

  await logAudit({
    userId: user.id,
    action: "interacao_registrada",
    entityType: "lead",
    entityId: leadId,
    after: { channel, type, result, note },
  });

  revalidatePath("/", "layout");
}
