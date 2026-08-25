import "dotenv/config";
import { db } from "./index";
import {
  users,
  leads,
  meetings,
  interactions,
  tasks,
  calendarSources,
} from "./schema";
import { eq } from "drizzle-orm";
import { seedBaseData } from "./seed";
import { recalculateMeetingRisk } from "@/lib/risk-score";
import { createCadenceTasksForMeeting } from "@/lib/tasks";
import { notify } from "@/lib/notifications";
import { simulateNewSelfBooking, simulateReschedule, simulateDuplicateSync } from "@/lib/calendar-simulator";

const FIRST_NAMES = [
  "Ana", "Bruno", "Carla", "Diego", "Elaine", "Fábio", "Gabriela", "Henrique",
  "Isabela", "Larissa", "Karina", "Lucas", "Mariana", "Nelson", "Olívia", "Pedro",
  "Rafaela", "Sérgio", "Tatiane", "Vinícius", "Yasmin", "Rodrigo", "Camila", "Felipe",
  "Beatriz", "Eduardo", "Juliana", "Marcelo", "Patrícia", "Renato",
];
const LAST_NAMES = [
  "Silva", "Souza", "Oliveira", "Santos", "Pereira", "Costa", "Rodrigues", "Almeida",
  "Nascimento", "Lima", "Araújo", "Fernandes", "Carvalho", "Gomes", "Martins", "Rocha",
];
const COMPANIES = [
  "Nova Era Consultoria", "Vértice Logística", "Prisma Digital", "Alto Padrão Imóveis",
  "Bravo Advocacia", "Cintra Alimentos", "Delta Engenharia", "Élite Estética",
  "Fortex Materiais", "Grão Café Express", "Horizonte Educação", "Ipê Saúde",
  "Jato Transportes", "Kairós Investimentos", "Lumen Marketing", "Metrópole Seguros",
  "Norte Sul Distribuidora", "Órbita Tecnologia", "Pontual Contabilidade", "Quality Fitness",
];
const ROLES = ["Sócio(a)", "Diretor(a) Comercial", "CEO", "Gerente de Marketing", "Head de Vendas", "Fundador(a)"];
const ORIGINS = ["Anúncio Meta Ads", "Anúncio Google Ads", "Indicação", "Orgânico Instagram", "Lista de e-mail", "Webinar"];
const NO_SHOW_REASONS = ["esqueceu", "problema_pessoal", "reuniao_interna", "falta_interesse", "nao_respondeu", "conflito_agenda", "problema_tecnico", "outro"] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}
function randomPhone() {
  const ddd = pick(["11", "21", "31", "41", "51", "61", "85", "27"]);
  const n = randInt(90000000, 99999999);
  return `+55 ${ddd} 9${n}`;
}
function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

async function createLead(sdrId: string, opts: { noShowHistory?: boolean } = {}) {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const company = pick(COMPANIES);
  const name = `${first} ${last}`;
  const email = `${stripAccents(first).toLowerCase()}.${stripAccents(last).toLowerCase()}${randInt(1, 999)}@${stripAccents(company).toLowerCase().split(" ")[0]}.com.br`;

  const [lead] = await db
    .insert(leads)
    .values({
      name,
      company,
      email,
      phone: randomPhone(),
      whatsapp: Math.random() > 0.2 ? randomPhone() : null,
      role: pick(ROLES),
      source: pick(ORIGINS),
      sdrUserId: sdrId,
      status: "reuniao_marcada",
    })
    .returning();
  return lead;
}

async function seedHistoricalMeetings(sdrId: string, sourceId: string, count: number) {
  const outcomes: { status: "compareceu" | "no_show" | "cancelado" | "realizada"; weight: number }[] = [
    { status: "compareceu", weight: 45 },
    { status: "realizada", weight: 20 },
    { status: "no_show", weight: 22 },
    { status: "cancelado", weight: 13 },
  ];
  const totalWeight = outcomes.reduce((s, o) => s + o.weight, 0);

  function pickOutcome() {
    let r = Math.random() * totalWeight;
    for (const o of outcomes) {
      if (r < o.weight) return o.status;
      r -= o.weight;
    }
    return "compareceu" as const;
  }

  for (let i = 0; i < count; i++) {
    const daysAgo = randInt(1, 60);
    const antecedenciaDays = pick([0, 1, 2, 3, 5, 8, 10, 14]);
    const createdAt = new Date(Date.now() - (daysAgo + antecedenciaDays) * 86400000);
    const scheduledAt = new Date(Date.now() - daysAgo * 86400000);
    scheduledAt.setHours(pick([9, 10, 11, 13, 14, 15, 16, 17]), pick([0, 30]), 0, 0);

    const status = pickOutcome();
    const lead = await createLead(sdrId);

    const [meeting] = await db
      .insert(meetings)
      .values({
        leadId: lead.id,
        googleEventId: `demo-hist-${lead.id}`,
        calendarSourceId: sourceId,
        scheduledAt,
        durationMinutes: 30,
        sdrUserId: sdrId,
        meetingType: "self_booking",
        status,
        confirmedAt: status !== "cancelado" ? new Date(scheduledAt.getTime() - 3600000) : null,
        attendedAt: ["compareceu", "realizada"].includes(status) ? scheduledAt : null,
        noShowAt: status === "no_show" ? scheduledAt : null,
        noShowReason: status === "no_show" ? pick(NO_SHOW_REASONS) : null,
        canceledAt: status === "cancelado" ? new Date(scheduledAt.getTime() - 7200000) : null,
        cancelReason: status === "cancelado" ? "Cliente remarcou prioridades internas" : null,
        rawTitle: `Self Booking — ${lead.name} (${lead.company})`,
        createdAt,
        updatedAt: scheduledAt,
      })
      .returning();

    // interações realistas
    const responded = Math.random() > (status === "no_show" ? 0.55 : 0.15);
    await db.insert(interactions).values({
      leadId: lead.id,
      meetingId: meeting.id,
      sdrUserId: sdrId,
      channel: "sistema",
      type: "Self Booking realizado",
      result: "neutro",
      createdAt,
    });
    if (responded) {
      await db.insert(interactions).values({
        leadId: lead.id,
        meetingId: meeting.id,
        sdrUserId: sdrId,
        channel: pick(["whatsapp", "ligacao"] as const),
        type: "Primeiro contato",
        result: status === "no_show" ? "respondeu" : "confirmou",
        createdAt: new Date(createdAt.getTime() + randInt(5, 240) * 60000),
      });
    }
    if (status === "no_show") {
      await db.insert(interactions).values({
        leadId: lead.id,
        meetingId: meeting.id,
        sdrUserId: sdrId,
        channel: "sistema",
        type: "No-show registrado",
        result: "cancelou",
        note: "Motivo: " + (meeting.noShowReason ?? "outro"),
        createdAt: scheduledAt,
      });
    }

    await db.update(leads).set({ lastContactAt: scheduledAt, status: status === "compareceu" || status === "realizada" ? "oportunidade" : "perdido" }).where(eq(leads.id, lead.id));
    await recalculateMeetingRisk(meeting.id);
  }
}

async function seedUpcomingMeetings(sdrId: string, sourceId: string) {
  const scenarios: { hoursFromNow: number; status: "agendado" | "aguardando_confirmacao" | "confirmado"; respond?: boolean }[] = [
    { hoursFromNow: 2, status: "aguardando_confirmacao" },
    { hoursFromNow: 5, status: "agendado" },
    { hoursFromNow: 8, status: "aguardando_confirmacao" },
    { hoursFromNow: 20, status: "aguardando_confirmacao" },
    { hoursFromNow: 22, status: "confirmado", respond: true },
    { hoursFromNow: 30, status: "agendado" },
    { hoursFromNow: 48, status: "confirmado", respond: true },
    { hoursFromNow: 50, status: "aguardando_confirmacao" },
    { hoursFromNow: 72, status: "agendado" },
    { hoursFromNow: 96, status: "confirmado", respond: true },
    { hoursFromNow: 168, status: "aguardando_confirmacao" },
    { hoursFromNow: 240, status: "agendado" }, // >7 dias de antecedência
  ];

  for (const scenario of scenarios) {
    const lead = await createLead(sdrId);
    const scheduledAt = new Date(Date.now() + scenario.hoursFromNow * 3600000);

    const [meeting] = await db
      .insert(meetings)
      .values({
        leadId: lead.id,
        googleEventId: `demo-upcoming-${lead.id}`,
        calendarSourceId: sourceId,
        scheduledAt,
        durationMinutes: 30,
        sdrUserId: sdrId,
        meetingType: "self_booking",
        status: scenario.status,
        confirmedAt: scenario.status === "confirmado" ? new Date() : null,
        rawTitle: `Self Booking — ${lead.name} (${lead.company})`,
      })
      .returning();

    await db.insert(interactions).values({
      leadId: lead.id,
      meetingId: meeting.id,
      sdrUserId: sdrId,
      channel: "sistema",
      type: "Self Booking realizado",
      result: "neutro",
    });

    if (scenario.respond) {
      await db.insert(interactions).values({
        leadId: lead.id,
        meetingId: meeting.id,
        sdrUserId: sdrId,
        channel: "whatsapp",
        type: "Confirmação de presença",
        result: "confirmou",
      });
    }

    await createCadenceTasksForMeeting(meeting.id);
    await recalculateMeetingRisk(meeting.id);
    await notify({
      userId: sdrId,
      type: "novo_self_booking",
      title: "Novo Self Booking",
      message: `${lead.name} · ${lead.company} agendou uma reunião.`,
      relatedEntityType: "meeting",
      relatedEntityId: meeting.id,
    });
  }
}

async function main() {
  console.log("Base seed...");
  const { joao, source } = await seedBaseData();

  console.log("Gerando histórico de reuniões (últimos 60 dias)...");
  await seedHistoricalMeetings(joao.id, source.id, 90);

  console.log("Gerando reuniões futuras (para dashboard, agenda e alertas de risco)...");
  await seedUpcomingMeetings(joao.id, source.id);

  console.log("Validando pipeline de sincronização via simulador (novo booking, remarcação e duplicidade)...");
  const pipelineResult = await simulateNewSelfBooking({
    calendarSourceId: source.id,
    sdrUserId: joao.id,
    scheduledAt: new Date(Date.now() + 4 * 3600000),
  });
  if (pipelineResult.meetingId) {
    const beforeCount = (await db.select().from(meetings)).length;
    await simulateDuplicateSync(pipelineResult.meetingId);
    const afterCount = (await db.select().from(meetings)).length;
    console.log(`  Teste de duplicidade: ${beforeCount} -> ${afterCount} reuniões (deve ser igual)`);
    await simulateReschedule(pipelineResult.meetingId, new Date(Date.now() + 30 * 3600000));
    console.log("  Reunião de teste remarcada com sucesso.");
  }

  console.log("\nSeed de demonstração concluído.");
  const totalLeads = (await db.select().from(leads)).length;
  const totalMeetings = (await db.select().from(meetings)).length;
  const totalTasks = (await db.select().from(tasks)).length;
  console.log(`  Leads: ${totalLeads} | Reuniões: ${totalMeetings} | Tarefas: ${totalTasks}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
