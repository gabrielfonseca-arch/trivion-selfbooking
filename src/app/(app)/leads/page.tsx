import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { leads, users, meetings } from "@/db/schema";
import { and, eq, or, ilike, desc, gte, inArray } from "drizzle-orm";
import { Avatar } from "@/components/ui/avatar";
import { RiskBadge, Badge } from "@/components/ui/badge";
import { LEAD_STATUS_LABEL } from "@/lib/labels";
import { formatDate, saoPauloDayBounds } from "@/lib/utils";
import { backfillLeadNamesAction } from "@/actions/leads";
import { MeetingQuickActions } from "@/components/app/meeting-quick-actions";
import Link from "next/link";
import { Wand2, Search } from "lucide-react";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const search = sp.q?.trim();
  const showAll = sp.todos === "1";

  // Por padrão só mostra leads com Self Booking a partir de hoje — evita
  // misturar com meses de histórico/teste. "Ver todos" acima da lista tira
  // esse filtro quando for preciso auditar leads antigos.
  let upcomingLeadIds: string[] | null = null;
  if (!showAll) {
    const { start: startToday } = saoPauloDayBounds(0);
    const upcoming = await db
      .selectDistinct({ leadId: meetings.leadId })
      .from(meetings)
      .where(gte(meetings.scheduledAt, startToday));
    upcomingLeadIds = upcoming.map((m) => m.leadId);
  }

  const conditions = [
    user.role === "sdr" ? eq(leads.sdrUserId, user.id) : undefined,
    upcomingLeadIds ? inArray(leads.id, upcomingLeadIds.length ? upcomingLeadIds : ["__none__"]) : undefined,
    search
      ? or(ilike(leads.name, `%${search}%`), ilike(leads.company, `%${search}%`), ilike(leads.email, `%${search}%`), ilike(leads.phone, `%${search}%`))
      : undefined,
  ].filter(Boolean);

  const rows = await db
    .select({ lead: leads, sdrName: users.name })
    .from(leads)
    .leftJoin(users, eq(leads.sdrUserId, users.id))
    .where(conditions.length ? and(...(conditions as never[])) : undefined)
    .orderBy(desc(leads.updatedAt))
    .limit(300);

  // Reunião "ativa" de cada lead (a mais recente que ainda não chegou a um
  // desfecho final) — usada para oferecer ações rápidas direto na lista.
  const leadIds = rows.map((r) => r.lead.id);
  const activeMeetingByLead = new Map<string, typeof meetings.$inferSelect>();
  if (leadIds.length > 0) {
    const allMeetings = await db
      .select()
      .from(meetings)
      .where(inArray(meetings.leadId, leadIds))
      .orderBy(desc(meetings.scheduledAt));
    // allMeetings já vem ordenado por data desc — a primeira ocorrência por
    // lead é a reunião mais recente, que é a relevante para ação rápida.
    for (const m of allMeetings) {
      if (!activeMeetingByLead.has(m.leadId)) activeMeetingByLead.set(m.leadId, m);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Leads</h2>
          <p className="text-sm text-muted mt-1">
            {rows.length} lead(s){!showAll && " com reunião a partir de hoje"} ·{" "}
            <Link href={showAll ? "/leads" : "/leads?todos=1"} className="text-brand hover:underline">
              {showAll ? "Ver só a partir de hoje" : "Ver todos"}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user.role !== "sdr" && (
            <form action={async () => { "use server"; await backfillLeadNamesAction(); }}>
              <button
                type="submit"
                title="Corrige leads cujo nome ficou igual ao e-mail, lendo o título da reunião na agenda"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-border text-sm font-medium px-3.5 py-2 hover:bg-gray-50"
              >
                <Wand2 size={15} /> Corrigir nomes automaticamente
              </button>
            </form>
          )}
          <form action="/leads" className="flex items-center gap-2">
            {showAll && <input type="hidden" name="todos" value="1" />}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                name="q"
                defaultValue={search}
                placeholder="Buscar por nome, empresa, e-mail ou telefone"
                className="rounded-lg border border-border pl-9 pr-3 py-2 text-sm w-72 outline-none focus:ring-2 focus:ring-brand/40"
              />
            </div>
            <button type="submit" className="rounded-lg bg-brand text-white text-sm font-medium px-3.5 py-2">Buscar</button>
          </form>
        </div>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted uppercase tracking-wide border-b border-border">
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Origem</th>
              <th className="px-4 py-3 font-medium">SDR</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Risco</th>
              <th className="px-4 py-3 font-medium">Último contato</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ lead, sdrName }) => {
              const activeMeeting = activeMeetingByLead.get(lead.id);
              return (
                <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="flex items-center gap-2.5">
                      <Avatar name={lead.name} size={30} />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{lead.name}</p>
                        <p className="text-xs text-muted truncate">{lead.company ?? lead.email ?? "—"}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{lead.source ?? "—"}</td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{sdrName ?? "—"}</td>
                  <td className="px-4 py-3"><Badge className="bg-slate-100 text-slate-700 ring-slate-500/20">{LEAD_STATUS_LABEL[lead.status]}</Badge></td>
                  <td className="px-4 py-3"><RiskBadge level={lead.riskLevel} score={lead.riskScore} /></td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{lead.lastContactAt ? formatDate(lead.lastContactAt) : "—"}</td>
                  <td className="px-4 py-3">
                    {activeMeeting ? <MeetingQuickActions meeting={activeMeeting} /> : <span className="text-xs text-muted">—</span>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted text-sm">Nenhum lead encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
