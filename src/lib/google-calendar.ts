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
    colorId?: string | null;
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
    colorId: raw.colorId ?? null,
  };
}

/**
 * Sincroniza um calendarSource específico com o Google Calendar real.
 * Usa syncToken para sincronização incremental (evita reprocessar tudo) e
 * lida com token expirado (HTTP 410) refazendo uma sincronização completa.
 */
/**
 * Janela da ressincronização completa (quando não há syncToken, ou quando o
 * Google expira o token e devolve 410).
 *
 * Eram 30 dias. O problema: essa varredura só grava o syncToken novo no fim de
 * tudo. Rodando dentro de uma função com limite de tempo, se ela é cortada no
 * meio nada é salvo, e a rodada seguinte recomeça do mesmo ponto — nunca
 * converge. Com 7 dias a varredura cabe folgada em uma rodada, e o sistema
 * volta para o modo incremental (rápido) já na próxima.
 *
 * 7 dias também cobre o que o app realmente usa: as telas listam reuniões a
 * partir de hoje, e o histórico mais antigo já está no banco.
 */
const FULL_RESYNC_DAYS = 7;

/**
 * Teto de páginas por rodada (100 eventos cada). Evita que uma agenda com
 * muita movimentação segure a rodada até o tempo acabar. Se o teto for
 * atingido, o que já foi processado permanece e o restante entra na próxima
 * rodada — que acontece em 5 minutos.
 */
const MAX_PAGES_PER_RUN = 5;

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
  let paginas = 0;
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
          : new Date(Date.now() - FULL_RESYNC_DAYS * 24 * 60 * 60 * 1000).toISOString(),
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
      paginas++;

      if (pageToken && paginas >= MAX_PAGES_PER_RUN) {
        console.warn(
          `[sync] ${source.label}: parei em ${paginas} páginas (teto por rodada). ` +
            `O restante entra na próxima sincronização.`
        );
        break;
      }
    } while (pageToken);

    // lastSyncAt é gravado mesmo quando a rodada parou no teto de páginas: ela
    // de fato processou eventos, e o horário serve para saber se a
    // sincronização está viva. O syncToken só avança quando o Google devolve
    // um novo (ou seja, quando a varredura chegou ao fim) — senão a próxima
    // rodada perderia os eventos que ficaram para trás.
    const gravadas = await db
      .update(calendarSources)
      .set({ syncToken: nextSyncToken ?? source.syncToken, lastSyncAt: new Date() })
      .where(eq(calendarSources.id, source.id))
      .returning({ id: calendarSources.id, lastSyncAt: calendarSources.lastSyncAt });

    // Quantas linhas a gravação afetou, e se o Google devolveu um syncToken
    // novo. Vai no retorno do endpoint porque é o único canal de diagnóstico
    // confiável aqui — o log das funções da Netlify não carrega. Se
    // `linhasGravadas` vier 0, a gravação não achou a linha; se vier 1 e o
    // horário mesmo assim não avançar na tela, o problema é de leitura.
    Object.assign(results, {
      agenda: source.label,
      linhasGravadas: gravadas.length,
      gravadoEm: gravadas[0]?.lastSyncAt ?? null,
      recebeuTokenNovo: Boolean(nextSyncToken),
      tinhaTokenAntes: Boolean(source.syncToken),
    });
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
  const summary = {
    criados: 0,
    atualizados: 0,
    remarcados: 0,
    cancelados: 0,
    ignorados: 0,
    // Detalhe por agenda: o que cada uma processou e o que conseguiu gravar.
    porAgenda: [] as unknown[],
  };
  for (const source of sources) {
    const r = await syncCalendarSource(source.id);
    summary.criados += r.criados;
    summary.atualizados += r.atualizados;
    summary.remarcados += r.remarcados;
    summary.cancelados += r.cancelados;
    summary.ignorados += r.ignorados;
    summary.porAgenda.push(r);
  }
  return summary;
}
