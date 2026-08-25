import { db } from "@/db";
import { notifications } from "@/db/schema";

export async function notify(params: {
  userId?: string | null;
  type:
    | "novo_self_booking"
    | "reuniao_em_risco"
    | "tarefa_atrasada"
    | "lead_confirmou"
    | "lead_cancelou"
    | "lead_no_show"
    | "outro";
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  await db.insert(notifications).values({
    userId: params.userId ?? null,
    type: params.type,
    title: params.title,
    message: params.message,
    relatedEntityType: params.relatedEntityType,
    relatedEntityId: params.relatedEntityId,
  });
}
