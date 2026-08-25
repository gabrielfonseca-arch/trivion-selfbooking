import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { meetings, leads, users } from "@/db/schema";
import { and, eq, gte, lte, or, ilike, desc, asc } from "drizzle-orm";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, RiskBadge } from "@/components/ui/badge";
import { formatDate, formatTime, cn } from "@/lib/utils";
import Link from "next/link";
import { confirmMeetingAction } from "@/actions/meetings";
import { CheckCircle2 } from "lucide-react";

const FILTERS = [
  { key: "hoje", label: "Hoje" },
  { key: "amanha", label: "Amanhã" },
  { key: "7dias", label: "Próximos 7 dias" },
  { key: "sem_confirmacao", label: "Sem confirmação" },
  { key: "alto_risco", label: "Alto risco" },
  { key: "confirmados", label: "Confirmados" },
  { key: "no_show", label: "No-show" },
  { key: "cancelados", label: "Cancelados" },
  { key: "remarcados", label: "Remarcados" },
] as const;

export default async function SelfBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const filter = sp.filtro;
  const search = sp.q?.trim();
  const sdrParam = sp.sdr;

  const conditions = [] as unknown[];

  if (user.role === "sdr") {
    conditions.push(eq(meetings.sdrUserId, user.id));
  } else if (sdrParam) {
    conditions.push(eq(meetings.sdrUserId, sdrParam));
  }

  const now = new Date();
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
  const startTomorrow = new Date(startToday.getTime() + 86400000);
  const endTomorrow = new Date(endToday.getTime() + 86400000);
  const in7 = new Date(now.getTime() + 7 * 86400000);

  if (filter === "hoje") conditions.push(and(gte(meetings.scheduledAt, startToday), lte(meetings.scheduledAt, endToday)));
  else if (filter === "amanha") conditions.push(and(gte(meetings.scheduledAt, startTomorrow), lte(meetings.scheduledAt, endTomorrow)));
  else if (filter === "7dias") conditions.push(and(gte(meetings.scheduledAt, now), lte(meetings.scheduledAt, in7)));
  else if (filter === "sem_confirmacao") conditions.push(or(eq(meetings.status, "agendado"), eq(meetings.status, "aguardando_confirmacao")));
  else if (filter === "alto_risco") conditions.push(eq(meetings.riskLevel, "alto"));
  else if (filter === "confirmados") conditions.push(eq(meetings.status, "confirmado"));
  else if (filter === "no_show") conditions.push(eq(meetings.status, "no_show"));
  else if (filter === "cancelados") conditions.push(eq(meetings.status, "cancelado"));
  else if (filter === "remarcados") conditions.push(eq(meetings.status, "remarcado"));

  if (search) {
    conditions.push(
      or(
        ilike(leads.name, `%${search}%`),
        ilike(leads.company, `%${search}%`),
        ilike(leads.email, `%${search}%`),
        ilike(leads.phone, `%${search}%`)
      )
    );
  }

  const rows = await db
    .select({ meeting: meetings, lead: leads, sdrName: users.name })
    .from(meetings)
    .innerJoin(leads, eq(meetings.leadId, leads.id))
    .leftJoin(users, eq(meetings.sdrUserId, users.id))
    .where(conditions.length ? and(...(conditions as never[])) : undefined)
    .orderBy(desc(meetings.scheduledAt))
    .limit(200);

  const sdrList = user.role !== "sdr" ? await db.select().from(users).where(eq(users.role, "sdr")) : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Self Bookings</h2>
          <p className="text-sm text-muted mt-1">{rows.length} reunião(ões) encontradas</p>
        </div>
        <form action="/self-bookings" className="flex items-center gap-2">
          {filter && <input type="hidden" name="filtro" value={filter} />}
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Buscar por nome, empresa, e-mail ou telefone"
            className="rounded-lg border border-border px-3 py-2 text-sm w-72 outline-none focus:ring-2 focus:ring-brand/40"
          />
          {sdrList.length > 0 && (
            <select
              name="sdr"
              defaultValue={sdrParam ?? ""}
              className="rounded-lg border border-border px-2.5 py-2 text-sm outline-none"
            >
              <option value="">Todos os SDRs</option>
              {sdrList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <button type="submit" className="rounded-lg bg-brand text-white text-sm font-medium px-3.5 py-2">
            Buscar
          </button>
        </form>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterLink label="Todos" active={!filter} href="/self-bookings" search={search} />
        {FILTERS.map((f) => (
          <FilterLink key={f.key} label={f.label} active={filter === f.key} href={`/self-bookings?filtro=${f.key}`} search={search} />
        ))}
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted uppercase tracking-wide border-b border-border">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Data / Horário</th>
              <th className="px-4 py-3 font-medium">SDR</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Risco</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ meeting, lead, sdrName }) => (
              <tr key={meeting.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} className="flex items-center gap-2.5">
                    <Avatar name={lead.name} size={30} />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{lead.name}</p>
                      <p className="text-xs text-muted truncate">{lead.company ?? "—"}</p>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatDate(meeting.scheduledAt)} · {formatTime(meeting.scheduledAt)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{sdrName ?? "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={meeting.status} /></td>
                <td className="px-4 py-3"><RiskBadge level={meeting.riskLevel} score={meeting.riskScore} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Link href={`/leads/${lead.id}`} className="text-xs font-medium text-brand hover:underline">
                      Abrir
                    </Link>
                    {!["confirmado", "cancelado", "no_show", "compareceu", "realizada"].includes(meeting.status) && (
                      <form action={confirmMeetingAction.bind(null, meeting.id)}>
                        <button
                          type="submit"
                          title="Confirmar"
                          className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-emerald-50 text-emerald-600"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted text-sm">
                  Nenhuma reunião encontrada para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterLink({ label, active, href, search }: { label: string; active: boolean; href: string; search?: string }) {
  const url = search ? `${href}${href.includes("?") ? "&" : "?"}q=${encodeURIComponent(search)}` : href;
  return (
    <Link
      href={url}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        active ? "bg-brand text-white border-brand" : "bg-white text-muted border-border hover:bg-gray-50"
      )}
    >
      {label}
    </Link>
  );
}
