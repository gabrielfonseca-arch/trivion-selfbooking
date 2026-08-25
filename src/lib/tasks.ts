import { db } from "@/db";
import { tasks, cadenceSteps, meetings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const DEFAULT_CADENCE: {
  stage: "imediato" | "d1" | "d0" | "proximo_horario";
  label: string;
  objective: string;
  offsetHoursFromMeeting: number;
  channelSuggestion: string;
  order: number;
}[] = [
  {
    stage: "imediato",
    label: "Confirmar Self Booking (contato imediato)",
    objective: "Criar conexão, validar intenção, reforçar valor e criar compromisso",
    offsetHoursFromMeeting: -100000, // criado assim que a reunião entra
    channelSuggestion: "whatsapp",
    order: 1,
  },
  {
    stage: "d1",
    label: "Confirmação D-1",
    objective: "Reforçar a reunião e confirmar presença",
    offsetHoursFromMeeting: -24,
    channelSuggestion: "whatsapp",
    order: 2,
  },
  {
    stage: "d0",
    label: "Lembrete D0",
    objective: "Lembrete para reduzir esquecimento",
    offsetHoursFromMeeting: -3,
    channelSuggestion: "whatsapp",
    order: 3,
  },
  {
    stage: "proximo_horario",
    label: "Confirmação de última hora",
    objective: "Garantir comparecimento",
    offsetHoursFromMeeting: -1,
    channelSuggestion: "ligacao",
    order: 4,
  },
];

export async function ensureDefaultCadence() {
  const existing = await db.select().from(cadenceSteps).limit(1);
  if (existing.length === 0) {
    await db.insert(cadenceSteps).values(
      DEFAULT_CADENCE.map((c) => ({ ...c, active: true }))
    );
  }
}

function priorityForStage(stage: string): "baixa" | "media" | "alta" | "critica" {
  if (stage === "proximo_horario") return "critica";
  if (stage === "d0") return "alta";
  if (stage === "d1") return "media";
  return "media";
}

/** Cria as tarefas automáticas de confirmação para uma reunião nova, com base na cadência configurada. */
export async function createCadenceTasksForMeeting(meetingId: string) {
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);
  if (!meeting) return;

  const steps = await db
    .select()
    .from(cadenceSteps)
    .where(eq(cadenceSteps.active, true));

  const values = steps.map((step) => {
    let dueAt: Date;
    if (step.offsetHoursFromMeeting < -1000) {
      dueAt = new Date(); // imediato
    } else {
      dueAt = new Date(
        meeting.scheduledAt.getTime() + step.offsetHoursFromMeeting * 60 * 60 * 1000
      );
      if (dueAt.getTime() < Date.now()) dueAt = new Date();
    }
    return {
      leadId: meeting.leadId,
      meetingId: meeting.id,
      assignedToId: meeting.sdrUserId,
      type:
        step.stage === "imediato"
          ? ("confirmar_self_booking" as const)
          : step.stage === "d1"
            ? ("confirmacao_d1" as const)
            : ("lembrete_d0" as const),
      title: step.label,
      dueAt,
      priority: priorityForStage(step.stage),
      status: "pendente" as const,
      note: step.objective,
    };
  });

  if (values.length > 0) {
    await db.insert(tasks).values(values);
  }
}

/** Cria uma tarefa de recuperação após um no-show ou cancelamento. */
export async function createRecoveryTask(params: {
  leadId: string;
  meetingId: string;
  assignedToId: string | null;
  reason: "no_show" | "cancelamento";
}) {
  await db.insert(tasks).values({
    leadId: params.leadId,
    meetingId: params.meetingId,
    assignedToId: params.assignedToId,
    type: "recuperacao_no_show",
    title:
      params.reason === "no_show"
        ? "Recuperação de No-show — contato imediato"
        : "Follow-up de recuperação após cancelamento",
    dueAt: new Date(Date.now() + 1000 * 60 * 30), // daqui a 30 min
    priority: "critica",
    status: "pendente",
    note:
      params.reason === "no_show"
        ? "Etapa 1 do workflow de recuperação: contato imediato após o no-show."
        : "Cliente cancelou — iniciar tentativa de recuperação.",
  });
}
