import { google } from "googleapis";
import { db } from "@/db";
import { googleIntegration, calendarSources } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/crypto";
import { ingestCalendarEvent } from "@/lib/ingest";
import type { NormalizedCalendarEvent } from "@/lib/self-booking-rules";

/**
 * MODELO DE INTEGRAÇÃO: uma única conta Google central se conecta via OAuth
 * (Configurações → Integrações). Cada closer compartilha sua própria agenda
 * do Google Calendar com essa conta central (permissão "Ver todos os
 * detalhes do evento"). A partir daí o sistema lê os eventos de cada agenda
 * compartilhada (cadastradas em `calendar_sources`) usando o token dessa
 * única conta — sem exigir que cada closer conecte a própria conta.
 */

// Escopo somente leitura: ler eventos, identificar criação/alteração/
// cancelamento/remarcação, consultar data/horário, título, descrição,
// participantes e link da reunião. O escopo de userinfo.email é necessário
// apenas para identificar (exibir) qual conta Google está conectada em
// Configurações → Integrações — sem ele, a chamada a oauth2.userinfo.get()
// em connectGoogleAccount() falha com 401 (escopo insuficiente).
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getGoogleAuthUrl() {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

/** Troca o código de autorização por tokens e salva a integração (conta central). */
export async function connectGoogleAccount(
  code: string,
  connectedByUserId: string
) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data: profile } = await oauth2.userinfo.get();

  const [existing] = await db.select().from(googleIntegration).limit(1);

  const values = {
    connectedEmail: profile.email ?? "conta-google",
    accessTokenEnc: tokens.access_token ? encrypt(tokens.access_token) : null,
    refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
    scope: tokens.scope ?? SCOPES.join(" "),
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    connectedByUserId,
    active: true,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(googleIntegration)
      .set(values)
      .where(eq(googleIntegration.id, existing.id));
    return existing.id;
  }
  const [created] = await db.insert(googleIntegration).values(values).returning();
  return created.id;
}

export async function disconnectGoogleAccount() {
  await db.update(googleIntegration).set({ active: false });
}

async function getAuthorizedClient() {
  const [integration] = await db
    .select()
    .from(googleIntegration)
    .where(eq(googleIntegration.active, true))
    .limit(1);
  if (!integration || !integration.refreshTokenEnc) return null;

  const client = getOAuthClient();
  client.setCredentials({
    refresh_token: decrypt(integration.refreshTokenEnc),
    access_token: integration.accessTokenEnc ? decrypt(integration.accessTokenEnc) : undefined,
  });
  return { client, integrationId: integration.id };
}

function normalizeEvent(
  raw: {
    id?: string | null;
    summary?: string | null;
    description?: string | null;
    status?: string | null;
    start?: { dateTime?: string | null; date?: string | null } | null;
    end?: { dateTime?: string | null; date?: string | null } | null;
    attendees?: { email?: string | null; displayName?: string | null }[] | null;
    organizer?: { email?: string | null } | null;
    hangoutLink?: string | null;
    location?: string | null;
    updated?: string | null;
  },
  calendarSourceLabel: string
): NormalizedCalendarEvent | null {
  if (!raw.id) return null;
  const startStr = raw.start?.dateTime ?? raw.start?.date;
  const endStr = raw.end?.dateTime ?? raw.end?.date;
  if (!startStr || !endStr) return null;

  return {
    googleEventId: raw.id,
    title: raw.summary ?? "(Sem título)",
    description: raw.description,
    start: new Date(startStr),
    end: new Date(endStr),
    attendees: (raw.attendees ?? []).map((a) => ({
      email: (a.email ?? "").toLowerCase(),
      name: a.displayName,
    })),
    organizerEmail: raw.organizer?.email,
    meetingLink: raw.hangoutLink ?? raw.location,
    location: raw.location,
    isCancelled: raw.status === "cancelled",
    updatedAt: raw.updated ? new Date(raw.updated) : new Date(),
    calendarSourceLabel,
  };
}

/**
 * Sincroniza um calendarSource específico com o Google Calendar real.
 * Usa syncToken para sincronização incremental (evita reprocessar tudo) e
 * lida com token expirado (HTTP 410) refazendo uma sincronização completa.
 */
export async function syncCalendarSource(calendarSourceId: string) {
  const authorized = await getAuthorizedClient();
  if (!authorized) {
    throw new Error(
      "Nenhuma conta Google conectada. Conecte em Configurações → Integrações."
    );
  }
  const [source] = await db
    .select()
    .from(calendarSources)
    .where(eq(calendarSources.id, calendarSourceId))
    .limit(1);
  if (!source) throw new Error("Agenda não encontrada");

  const calendar = google.calendar({ version: "v3", auth: authorized.client });

  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  const results = { criados: 0, atualizados: 0, remarcados: 0, cancelados: 0, ignorados: 0 };

  try {
    do {
      const { data } = await calendar.events.list({
        calendarId: source.calendarId,
        singleEvents: true,
        syncToken: source.syncToken ?? undefined,
        pageToken,
        maxResults: 100,
        timeMin: source.syncToken
          ? undefined
          : new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
      });

      for (const raw of data.items ?? []) {
        const normalized = normalizeEvent(raw, source.label);
        if (!normalized) continue;
        const result = await ingestCalendarEvent(
          normalized,
          source.id,
          source.sdrUserId
        );
        if (result.outcome === "criado") results.criados++;
        else if (result.outcome === "atualizado") results.atualizados++;
        else if (result.outcome === "remarcado") results.remarcados++;
        else if (result.outcome === "cancelado") results.cancelados++;
        else results.ignorados++;
      }

      pageToken = data.nextPageToken ?? undefined;
      nextSyncToken = data.nextSyncToken ?? nextSyncToken;
    } while (pageToken);

    await db
      .update(calendarSources)
      .set({ syncToken: nextSyncToken ?? source.syncToken, lastSyncAt: new Date() })
      .where(eq(calendarSources.id, source.id));
  } catch (err: unknown) {
    const status = (err as { code?: number; response?: { status?: number } })?.code ??
      (err as { response?: { status?: number } })?.response?.status;
    if (status === 410) {
      // syncToken expirado: limpa e refaz sincronização completa na próxima chamada
      await db
        .update(calendarSources)
        .set({ syncToken: null })
        .where(eq(calendarSources.id, source.id));
      return syncCalendarSource(calendarSourceId);
    }
    throw err;
  }

  return results;
}

export async function syncAllCalendarSources() {
  const sources = await db
    .select()
    .from(calendarSources)
    .where(eq(calendarSources.active, true));
  const summary = { criados: 0, atualizados: 0, remarcados: 0, cancelados: 0, ignorados: 0 };
  for (const source of sources) {
    const r = await syncCalendarSource(source.id);
    summary.criados += r.criados;
    summary.atualizados += r.atualizados;
    summary.remarcados += r.remarcados;
    summary.cancelados += r.cancelados;
    summary.ignorados += r.ignorados;
  }
  return summary;
}
