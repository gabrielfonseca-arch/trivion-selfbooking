"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function completeTaskAction(taskId: string) {
  const user = await requireUser();
  await db
    .update(tasks)
    .set({ status: "concluida", completedAt: new Date() })
    .where(eq(tasks.id, taskId));
  await logAudit({ userId: user.id, action: "tarefa_concluida", entityType: "task", entityId: taskId });
  revalidatePath("/", "layout");
}

export async function postponeTaskAction(taskId: string, hours: number = 24) {
  const user = await requireUser();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return;
  const newDue = new Date(task.dueAt.getTime() + hours * 60 * 60 * 1000);
  await db
    .update(tasks)
    .set({ status: "adiada", dueAt: newDue })
    .where(eq(tasks.id, taskId));
  await logAudit({ userId: user.id, action: "tarefa_adiada", entityType: "task", entityId: taskId, after: { newDue } });
  revalidatePath("/", "layout");
}
