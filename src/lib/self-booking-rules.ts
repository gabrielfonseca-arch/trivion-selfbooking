import type { selfBookingRules } from "@/db/schema";

export type NormalizedCalendarEvent = {
  googleEventId: string;
  title: string;
  description?: string | null;
  start: Date;
  end: Date;
  attendees: { email: string; name?: string | null }[];
  organizerEmail?: string | null;
  meetingLink?: string | null;
  location?: string | null;
  isCancelled: boolean;
  updatedAt: Date;
  calendarSourceLabel?: string | null;
};

type Rule = typeof selfBookingRules.$inferSelect;

// Prefixos usados pelos SDRs para identificar reuniões que ELES agendaram
// manualmente (não são Self Booking do lead). Ex: "SA | João e Felipe Paiva",
// "SL | Marcéllio e Vitor Moura". Checagem case-insensitive.
const SDR_BOOKING_PREFIXES = ["SA", "SL"];

// Closers conhecidos hoje, do jeito que o nome aparece no título dos eventos
// ("<cliente> e <closer>"). Ao contratar um novo closer, adicione o nome
// aqui — ou simplesmente nomeie a agenda monitorada em Configurações →
// Integrações com esse mesmo nome (ex: "Maria" ou "Maria - Closer"), que o
// sistema já reconhece automaticamente pelo rótulo da agenda de origem.
export const KNOWN_CLOSER_NAMES = ["Felipe Paiva", "Vitor Moura"];

function hasSdrBookingPrefix(title: string): boolean {
  const t = title.trim().toUpperCase();
  return SDR_BOOKING_PREFIXES.some(
    (p) => t.startsWith(`${p} `) || t.startsWith(`${p}|`) || t.startsWith(`${p} |`)
  );
}

function closerNamesForEvent(event: NormalizedCalendarEvent): string[] {
  const names = [...KNOWN_CLOSER_NAMES];
  if (event.calendarSourceLabel) {
    // "Felipe Paiva - Closer" -> "Felipe Paiva"
    const fromLabel = event.calendarSourceLabel.split(/[-|]/)[0].trim();
    if (fromLabel) names.push(fromLabel);
  }
  return names;
}

/** Título no padrão "<cliente> e <closer>", sem prefixo de agendamento do SDR. */
function matchesCloserPattern(event: NormalizedCalendarEvent): boolean {
  const title = event.title.toLowerCase();
  return closerNamesForEvent(event).some((name) =>
    title.includes(` e ${name.toLowerCase()}`)
  );
}

/**
 * Decide se um evento do Google Calendar deve ser tratado como Self Booking.
 * Não depende só do título: considera calendário de origem, palavras-chave,
 * padrão de e-mail do participante e responsável configurados em
 * Configurações → Regras de Self Booking.
 *
 * Eventos com prefixo "SA"/"SL" no título são sempre agendamentos feitos
 * pelo próprio SDR (não Self Booking), independente de outras regras.
 *
 * Se não houver nenhuma regra ativa cadastrada, usa o padrão
 * "<cliente> e <closer>" no título para diferenciar Self Booking de outras
 * reuniões (onboarding, treinamento etc.) que também aparecem na mesma
 * agenda monitorada.
 */
export function matchesSelfBookingRules(
  event: NormalizedCalendarEvent,
  calendarSourceId: string | null,
  rules: Rule[]
): boolean {
  if (hasSdrBookingPrefix(event.title)) return false;

  const activeRules = rules.filter((r) => r.active);
  if (activeRules.length === 0) return matchesCloserPattern(event);

  const applicable = activeRules.filter(
    (r) => !r.calendarSourceId || r.calendarSourceId === calendarSourceId
  );
  if (applicable.length === 0) return matchesCloserPattern(event);

  return applicable.some((rule) => ruleMatches(event, rule));
}

function ruleMatches(event: NormalizedCalendarEvent, rule: Rule): boolean {
  let matched = true;

  if (rule.titleKeywords) {
    const keywords = rule.titleKeywords
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    if (keywords.length > 0) {
      const title = event.title.toLowerCase();
      matched = matched && keywords.some((k) => title.includes(k));
    }
  }

  if (rule.attendeeEmailPattern) {
    const pattern = rule.attendeeEmailPattern.trim();
    if (pattern && pattern !== "*" && pattern !== "*@*") {
      const domain = pattern.replace("*@", "").toLowerCase();
      matched =
        matched &&
        event.attendees.some((a) => a.email.toLowerCase().endsWith(domain));
    }
  }

  return matched;
}

/** Identifica o participante externo (o lead) dentre os attendees do evento. */
export function extractLeadAttendee(
  event: NormalizedCalendarEvent,
  internalDomains: string[]
): { email: string; name?: string | null } | null {
  const external = event.attendees.filter(
    (a) =>
      !internalDomains.some((d) => a.email.toLowerCase().endsWith(d.toLowerCase())) &&
      a.email.toLowerCase() !== (event.organizerEmail ?? "").toLowerCase()
  );
  return external[0] ?? event.attendees[0] ?? null;
}
