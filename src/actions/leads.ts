"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function updateLeadAction(leadId: string, formData: FormData) {
  const user = await requireUser();
  const [before] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!before) throw new Error("Lead não encontrado");
  if (user.role === "sdr" && before.sdrUserId !== user.id) {
    throw new Error("Sem permissão para editar este lead");
  }

  const patch = {
    name: String(formData.get("name") || before.name),
    company: (formData.get("company") as string) || null,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    whatsapp: (formData.get("whatsapp") as string) || null,
    role: (formData.get("role") as string) || null,
    updatedAt: new Date(),
  };

  await db.update(leads).set(patch).where(eq(leads.id, leadId));
  await logAudit({
    userId: user.id,
    action: "lead_atualizado",
    entityType: "lead",
    entityId: leadId,
    before,
    after: patch,
  });
  revalidatePath("/", "layout");
}
