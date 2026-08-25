import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export async function logAudit(params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  await db.insert(auditLogs).values({
    userId: params.userId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    before: params.before ? JSON.parse(JSON.stringify(params.before)) : null,
    after: params.after ? JSON.parse(JSON.stringify(params.after)) : null,
  });
}
