import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { meetings, leads, users } from "@/db/schema";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, RiskBadge } from "@/components/ui/badge";
import { formatTime, cn } from "@/lib/utils";
import Link from "next/link";

type View = "dia" | "semana" | "mes";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function startOfWeek(d: Date) { const x = startOfDay(d); const day = x.getDay(); x.setDate(x.getDate() - day); return x; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = (sp.view as View) || "semana";
  const refDate = sp.data ? new Date(sp.data) : new Date();

  let rangeStart: Date, rangeEnd: Date;
  if (view === "dia") { rangeStart = startOfDay(refDate); rangeEnd = endOfDay(refDate); }
  else if (view === "mes") { rangeStart = startOfMonth(refDate); rangeEnd = endOfMonth(refDate); }
  else { rangeStart = startOfWeek(refDate); rangeEnd = endOfDay(addDays(rangeStart, 6)); }

  const conditions = [
    gte(meetings.scheduledAt, rangeStart),
    lte(meetings.scheduledAt, rangeEnd),
    user.role === "sdr" ? eq(meetings.sdrUserId, user.id) : undefined,
  ].filter(Boolean);

  const rows = await db
    .select({ meeting: meetings, lead: leads, sdrName: users.name })
    .from(meetings)
    .innerJoin(leads, eq(meetings.leadId, leads.id))
    .leftJoin(users, eq(meetings.sdrUserId, users.id))
    .where(and(...conditions))
    .orderBy(asc(meetings.scheduledAt));

  const prevDate = view === "dia" ? addDays(refDate, -1) : view === "mes" ? new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1) : addDays(refDate, -7);
  const nextDate = view === "dia" ? addDays(refDate, 1) : view === "mes" ? new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1) : addDays(refDate, 7);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Agenda</h2>
          <p className="text-sm text-muted mt-1">{rows.length} reunião(ões) no período</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["dia", "semana", "mes"] as View[]).map((v) => (
              <Link
                key={v}
                href={`/agenda?view=${v}&data=${refDate.toISOString().slice(0, 10)}`}
                className={cn("px-3 py-1.5 text-xs font-medium", view === v ? "bg-brand text-brand-ink" : "bg-white text-muted hover:bg-gray-50")}
              >
                {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
              </Link>
            ))}
          </div>
          <Link href={`/agenda?view=${view}&data=${prevDate.toISOString().slice(0, 10)}`} className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-gray-50">← Anterior</Link>
          <Link href={`/agenda?view=${view}&data=${new Date().toISOString().slice(0, 10)}`} className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-gray-50">Hoje</Link>
          <Link href={`/agenda?view=${view}&data=${nextDate.toISOString().slice(0, 10)}`} className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-gray-50">Próximo →</Link>
        </div>
      </div>

      {view === "mes" ? (
        <MonthGrid rangeStart={startOfMonth(refDate)} rows={rows} />
      ) : (
        <div className={cn("grid gap-4", view === "semana" ? "grid-cols-1 md:grid-cols-7" : "grid-cols-1")}>
          {daysInRange(rangeStart, rangeEnd).map((day) => {
            const dayRows = rows.filter((r) => sameDay(r.meeting.scheduledAt, day));
            return (
              <div key={day.toISOString()} className="card p-3 flex flex-col gap-2 min-h-[140px]">
                <p className="text-xs font-semibold text-muted uppercase">
                  {day.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                </p>
                {dayRows.length === 0 && <p className="text-xs text-muted py-2">Sem reuniões</p>}
                {dayRows.map(({ meeting, lead, sdrName }) => (
                  <Link
                    key={meeting.id}
                    href={`/leads/${lead.id}`}
                    className="flex flex-col gap-1 rounded-lg border border-border px-2.5 py-2 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold tabular-nums">{formatTime(meeting.scheduledAt)}</span>
                      <RiskBadge level={meeting.riskLevel} />
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Avatar name={lead.name} size={20} />
                      <span className="text-xs font-medium truncate">{lead.name}</span>
                    </div>
                    <p className="text-[11px] text-muted truncate">{lead.company ?? "—"} {sdrName ? `· ${sdrName}` : ""}</p>
                    <StatusBadge status={meeting.status} />
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function daysInRange(start: Date, end: Date) {
  const days: Date[] = [];
  let cur = startOfDay(start);
  while (cur <= end) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function MonthGrid({
  rangeStart,
  rows,
}: {
  rangeStart: Date;
  rows: { meeting: typeof meetings.$inferSelect; lead: typeof leads.$inferSelect; sdrName: string | null }[];
}) {
  const gridStart = startOfWeek(rangeStart);
  const monthEnd = endOfMonth(rangeStart);
  const gridEnd = addDays(startOfWeek(monthEnd), 6);
  const days = daysInRange(gridStart, gridEnd);

  return (
    <div className="card p-3">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="text-[11px] font-semibold text-muted text-center py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayRows = rows.filter((r) => sameDay(r.meeting.scheduledAt, day));
          const inMonth = day.getMonth() === rangeStart.getMonth();
          return (
            <div
              key={day.toISOString()}
              className={cn("min-h-[92px] rounded-lg border border-border p-1.5 flex flex-col gap-1", !inMonth && "opacity-40 bg-gray-50")}
            >
              <span className="text-[11px] font-medium text-muted">{day.getDate()}</span>
              {dayRows.slice(0, 3).map(({ meeting, lead }) => (
                <Link
                  key={meeting.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center gap-1 text-[10px] rounded px-1 py-0.5 bg-brand/5 hover:bg-brand/10 truncate"
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", meeting.riskLevel === "alto" ? "bg-red-500" : meeting.riskLevel === "medio" ? "bg-amber-500" : "bg-emerald-500")} />
                  <span className="truncate">{formatTime(meeting.scheduledAt)} {lead.name}</span>
                </Link>
              ))}
              {dayRows.length > 3 && <span className="text-[10px] text-muted">+{dayRows.length - 3} mais</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
