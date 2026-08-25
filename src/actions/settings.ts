"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  selfBookingRules,
  riskFactors,
  riskThresholds,
  cadenceSteps,
  goals,
  scripts,
} from "@/db/schema";
import { requireRole, requireUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";

// ---------------------------------------------------------------------------
// USUÁRIOS
// ---------------------------------------------------------------------------

export async function createUserAction(formData: FormData) {
  const admin = await requireRole(["admin"]);
  const name = String(formData.get("name") || "");
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const role = String(formData.get("role") || "sdr") as "admin" | "coordinator" | "sdr";
  const password = String(formData.get("password") || "trivion123");

  if (!name || !email) throw new Error("Nome e e-mail são obrigatórios");

  const passwordHash = await hashPassword(password);
  const [created] = await db.insert(users).values({ name, email, role, passwordHash }).returning();

  await logAudit({ userId: admin.id, action: "usuario_criado", entityType: "user", entityId: created.id, after: { name, email, role } });
  revalidatePath("/settings/users");
}

export async function toggleUserStatusAction(userId: string) {
  const admin = await requireRole(["admin"]);
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;
  const status = user.status === "active" ? "inactive" : "active";
  await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
  await logAudit({ userId: admin.id, action: "usuario_status_alterado", entityType: "user", entityId: userId, after: { status } });
  revalidatePath("/settings/users");
}

export async function updateUserRoleAction(userId: string, role: "admin" | "coordinator" | "sdr") {
  const admin = await requireRole(["admin"]);
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
  await logAudit({ userId: admin.id, action: "usuario_perfil_alterado", entityType: "user", entityId: userId, after: { role } });
  revalidatePath("/settings/users");
}

// ---------------------------------------------------------------------------
// REGRAS DE SELF BOOKING
// ---------------------------------------------------------------------------

export async function createRuleAction(formData: FormData) {
  const admin = await requireRole(["admin"]);
  const values = {
    name: String(formData.get("name") || "Nova regra"),
    titleKeywords: (formData.get("titleKeywords") as string) || null,
    attendeeEmailPattern: (formData.get("attendeeEmailPattern") as string) || null,
    meetingTypeMatch: (formData.get("meetingTypeMatch") as string) || null,
    responsibleMatch: (formData.get("responsibleMatch") as string) || null,
  };
  const [created] = await db.insert(selfBookingRules).values(values).returning();
  await logAudit({ userId: admin.id, action: "regra_criada", entityType: "self_booking_rule", entityId: created.id, after: values });
  revalidatePath("/settings/rules");
}

export async function toggleRuleAction(ruleId: string) {
  const admin = await requireRole(["admin"]);
  const [rule] = await db.select().from(selfBookingRules).where(eq(selfBookingRules.id, ruleId)).limit(1);
  if (!rule) return;
  await db.update(selfBookingRules).set({ active: !rule.active }).where(eq(selfBookingRules.id, ruleId));
  await logAudit({ userId: admin.id, action: "regra_alterada", entityType: "self_booking_rule", entityId: ruleId, after: { active: !rule.active } });
  revalidatePath("/settings/rules");
}

// ---------------------------------------------------------------------------
// SCORE DE RISCO
// ---------------------------------------------------------------------------

export async function updateRiskFactorAction(factorId: string, points: number, active: boolean) {
  const admin = await requireRole(["admin"]);
  await db.update(riskFactors).set({ points, active }).where(eq(riskFactors.id, factorId));
  await logAudit({ userId: admin.id, action: "fator_risco_atualizado", entityType: "risk_factor", entityId: factorId, after: { points, active } });
  revalidatePath("/settings/risk-score");
}

export async function updateRiskThresholdsAction(lowMax: number, mediumMax: number) {
  const admin = await requireRole(["admin"]);
  const [existing] = await db.select().from(riskThresholds).limit(1);
  if (existing) {
    await db.update(riskThresholds).set({ lowMax, mediumMax }).where(eq(riskThresholds.id, existing.id));
  } else {
    await db.insert(riskThresholds).values({ lowMax, mediumMax });
  }
  await logAudit({ userId: admin.id, action: "limiares_risco_atualizados", entityType: "risk_thresholds", after: { lowMax, mediumMax } });
  revalidatePath("/settings/risk-score");
}

// ---------------------------------------------------------------------------
// CADÊNCIA
// ---------------------------------------------------------------------------

export async function updateCadenceStepAction(
  stepId: string,
  data: { offsetHoursFromMeeting: number; channelSuggestion: string; active: boolean }
) {
  const admin = await requireRole(["admin"]);
  await db.update(cadenceSteps).set(data).where(eq(cadenceSteps.id, stepId));
  await logAudit({ userId: admin.id, action: "cadencia_atualizada", entityType: "cadence_step", entityId: stepId, after: data });
  revalidatePath("/settings/cadence");
}

// ---------------------------------------------------------------------------
// METAS
// ---------------------------------------------------------------------------

export async function updateGoalAction(goalId: string, targetValue: number) {
  const admin = await requireRole(["admin", "coordinator"]);
  await db.update(goals).set({ targetValue, updatedAt: new Date() }).where(eq(goals.id, goalId));
  await logAudit({ userId: admin.id, action: "meta_atualizada", entityType: "goal", entityId: goalId, after: { targetValue } });
  revalidatePath("/settings/goals");
}

// ---------------------------------------------------------------------------
// SCRIPTS
// ---------------------------------------------------------------------------

export async function updateScriptAction(scriptId: string, content: string) {
  const user = await requireRole(["admin", "coordinator"]);
  await db.update(scripts).set({ content, updatedByUserId: user.id, updatedAt: new Date() }).where(eq(scripts.id, scriptId));
  await logAudit({ userId: user.id, action: "script_atualizado", entityType: "script", entityId: scriptId });
  revalidatePath("/scripts");
}

export async function createScriptAction(formData: FormData) {
  const user = await requireRole(["admin", "coordinator"]);
  const values = {
    category: String(formData.get("category") || "primeiro_contato") as never,
    title: String(formData.get("title") || "Novo script"),
    content: String(formData.get("content") || ""),
    updatedByUserId: user.id,
  };
  await db.insert(scripts).values(values);
  await logAudit({ userId: user.id, action: "script_criado", entityType: "script" });
  revalidatePath("/scripts");
}

export async function noop() {
  await requireUser();
}
