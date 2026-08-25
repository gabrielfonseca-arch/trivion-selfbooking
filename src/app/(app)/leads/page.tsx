import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { leads, users } from "@/db/schema";
import { and, eq, or, ilike, desc } from "drizzle-orm";
import { Avatar } from "@/components/ui/avatar";
import { RiskBadge, Badge } from "@/components/ui/badge";
import { LEAD_STATUS_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const search = sp.q?.trim();

  const conditions = [
    user.role === "sdr" ? eq(leads.sdrUserId, user.id) : undefined,
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Leads</h2>
          <p className="text-sm text-muted mt-1">{rows.length} lead(s)</p>
        </div>
        <form action="/leads" className="flex items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Buscar por nome, empresa, e-mail ou telefone"
            className="rounded-lg border border-border px-3 py-2 text-sm w-72 outline-none focus:ring-2 focus:ring-brand/40"
          />
          <button type="submit" className="rounded-lg bg-brand text-white text-sm font-medium px-3.5 py-2">Buscar</button>
        </form>
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
            </tr>
          </thead>
          <tbody>
            {rows.map(({ lead, sdrName }) => (
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
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted text-sm">Nenhum lead encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
