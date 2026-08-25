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

/**
 * Decide se um evento do Google Calendar deve ser tratado como Self Booking.
 * Não depende só do título: considera calendário de origem, palavras-chave,
 * padrão de e-mail do participante e responsável configurados em
 * Configurações → Regras de Self Booking.
 *
 * Se não houver nenhuma regra ativa cadastrada, todo evento vindo de um
 * calendário monitorado (calendarSourceId configurado) é tratado como
 * Self Booking por padrão — já que essas agendas são dedicadas a isso.
 */
export function matchesSelfBookingRules(
  event: NormalizedCalendarEvent,
  calendarSourceId: string | null,
  rules: Rule[]
): boolean {
  const activeRules = rules.filter((r) => r.active);
  if (activeRules.length === 0) return true;

  const applicable = activeRules.filter(
    (r) => !r.calendarSourceId || r.calendarSourceId === calendarSourceId
  );
  if (applicable.length === 0) return true;

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
