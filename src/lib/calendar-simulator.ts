import { randomUUID } from "crypto";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ingestCalendarEvent } from "@/lib/ingest";
import { KNOWN_CLOSER_NAMES, type NormalizedCalendarEvent } from "@/lib/self-booking-rules";

/**
 * Simulador de sincronização com o Google Calendar.
 *
 * Enquanto as credenciais OAuth reais não são configuradas (Configurações →
 * Integrações), este módulo gera eventos realistas de Self Booking e os
 * processa através do MESMO pipeline (`ingestCalendarEvent`) usado pela
 * sincronização real com a Google Calendar API — ou seja, identificação de
 * regras, criação/atualização de lead e reunião, prevenção de duplicidade,
 * cálculo de score e criação de tarefas funcionam de ponta a ponta como na
 * integração real. Basta trocar `ENABLE_CALENDAR_SIMULATOR` por credenciais
 * reais em Configurações para migrar sem alterar nenhuma outra parte do
 * sistema.
 */

const FIRST_NAMES = [
  "Ana", "Bruno", "Carla", "Diego", "Elaine", "Fábio", "Gabriela", "Henrique",
  "Isabela", "João", "Karina", "Lucas", "Mariana", "Nelson", "Olívia", "Pedro",
  "Rafaela", "Sérgio", "Tatiane", "Vinícius", "Yasmin", "Rodrigo", "Camila", "Felipe",
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
];
const ROLES = ["Sócio(a)", "Diretor(a) Comercial", "CEO", "Gerente de Marketing", "Head de Vendas", "Fundador(a)"];
const ORIGINS = ["Anúncio Meta Ads", "Anúncio Google Ads", "Indicação", "Orgânico Instagram", "Lista de e-mail", "Webinar"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone() {
  const ddd = pick(["11", "21", "31", "41", "51", "61", "85", "27"]);
  const n = Math.floor(90000000 + Math.random() * 9999999);
  return `+55 ${ddd} 9${n}`;
}

export function buildFakeSelfBookingEvent(params: {
  scheduledAt: Date;
  daysAgoCreated?: number;
  googleEventId?: string;
}): { event: NormalizedCalendarEvent; leadName: string; company: string } {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const company = pick(COMPANIES);
  const leadName = `${first} ${last}`;
  const closerName = pick(KNOWN_CLOSER_NAMES);
  const email = `${first}.${last}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + "@" +
    company.toLowerCase().split(" ")[0].normalize("NFD").replace(/[̀-ͯ]/g, "") + ".com.br";

  const event: NormalizedCalendarEvent = {
    googleEventId: params.googleEventId ?? `sim-${randomUUID()}`,
    // Segue o mesmo padrão de título usado nos eventos reais de Self
    // Booking ("<cliente> e <closer>"), para exercitar a mesma lógica de
    // classificação usada na sincronização real.
    title: `${leadName} e ${closerName}`,
    description: `Reunião agendada automaticamente pelo formulário de Self Booking.\nCargo: ${pick(ROLES)}\nOrigem: ${pick(ORIGINS)}\nTelefone: ${randomPhone()}`,
    start: params.scheduledAt,
    end: new Date(params.scheduledAt.getTime() + 30 * 60000),
    attendees: [
      { email, name: leadName },
      { email: "joao.gabriel@grupotrivion.com", name: "João Gabriel" },
    ],
    organizerEmail: email,
    meetingLink: "https://meet.google.com/" + randomUUID().slice(0, 10),
    isCancelled: false,
    updatedAt: new Date(),
    calendarSourceLabel: `${closerName} - Closer (simulado)`,
  };

  return { event, leadName, company };
}

export async function simulateNewSelfBooking(params: {
  calendarSourceId: string;
  sdrUserId: string | null;
  scheduledAt: Date;
}) {
  const { event } = buildFakeSelfBookingEvent({ scheduledAt: params.scheduledAt });
  return ingestCalendarEvent(event, params.calendarSourceId, params.sdrUserId);
}

/** Reprocessa o mesmo evento sem alterações — deve ser idempotente (sem duplicar). */
export async function simulateDuplicateSync(meetingId: string) {
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
  if (!meeting || !meeting.googleEventId) throw new Error("Reunião simulada não encontrada");

  const event: NormalizedCalendarEvent = {
    googleEventId: meeting.googleEventId,
    title: meeting.rawTitle ?? "Self Booking",
    description: meeting.rawDescription,
    start: meeting.scheduledAt,
    end: new Date(meeting.scheduledAt.getTime() + meeting.durationMinutes * 60000),
    attendees: [],
    isCancelled: false,
    updatedAt: new Date(),
  };
  return ingestCalendarEvent(event, meeting.calendarSourceId!, meeting.sdrUserId);
}

/** Simula uma remarcação: mesmo googleEventId, novo horário. */
export async function simulateReschedule(meetingId: string, newScheduledAt: Date) {
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
  if (!meeting || !meeting.googleEventId) throw new Error("Reunião simulada não encontrada");

  const event: NormalizedCalendarEvent = {
    googleEventId: meeting.googleEventId,
    title: meeting.rawTitle ?? "Self Booking",
    description: meeting.rawDescription,
    start: newScheduledAt,
    end: new Date(newScheduledAt.getTime() + meeting.durationMinutes * 60000),
    attendees: [],
    isCancelled: false,
    updatedAt: new Date(),
  };
  return ingestCalendarEvent(event, meeting.calendarSourceId!, meeting.sdrUserId);
}

/** Simula um cancelamento no Google Calendar. */
export async function simulateCancellation(meetingId: string) {
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
  if (!meeting || !meeting.googleEventId) throw new Error("Reunião simulada não encontrada");

  const event: NormalizedCalendarEvent = {
    googleEventId: meeting.googleEventId,
    title: meeting.rawTitle ?? "Self Booking",
    start: meeting.scheduledAt,
    end: new Date(meeting.scheduledAt.getTime() + meeting.durationMinutes * 60000),
    attendees: [],
    isCancelled: true,
    updatedAt: new Date(),
  };
  return ingestCalendarEvent(event, meeting.calendarSourceId!, meeting.sdrUserId);
}
