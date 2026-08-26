import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { leads, meetings, interactions, users } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { RiskBadge, StatusBadge, Badge } from "@/components/ui/badge";
import { LeadTimeline } from "@/components/app/lead-timeline";
import { LeadActions } from "@/components/app/lead-actions";
import { updateLeadAction } from "@/actions/leads";
import { LEAD_STATUS_LABEL } from "@/lib/labels";
import { formatDateTime, formatDate, formatTime } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!lead) notFound();
  if (user.role === "sdr" && lead.sdrUserId !== user.id) notFound();

  const leadMeetings = await db
    .select({ meeting: meetings, sdrName: users.name })
    .from(meetings)
    .leftJoin(users, eq(meetings.sdrUserId, users.id))
    .where(eq(meetings.leadId, id))
    .orderBy(desc(meetings.scheduledAt));

  const activeMeeting =
    leadMeetings.find((m) => !["cancelado", "no_show", "compareceu", "realizada"].includes(m.meeting.status)) ??
    leadMeetings[0];

  const leadInteractions = await db
    .select()
    .from(interactions)
    .where(eq(interactions.leadId, id))
    .orderBy(asc(interactions.createdAt));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={lead.name} size={48} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-foreground">{lead.name}</h2>
              <Badge className="bg-slate-100 text-slate-700 ring-slate-500/20">{LEAD_STATUS_LABEL[lead.status]}</Badge>
              <RiskBadge level={lead.riskLevel} score={lead.riskScore} />
            </div>
            <p className="text-sm text-muted mt-0.5">
              {lead.company ?? "Empresa não informada"} {lead.role ? `· ${lead.role}` : ""}
            </p>
          </div>
        </div>
        <Link href="/leads" className="text-sm text-brand-strong hover:underline">← Voltar para Leads</Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3">Central de Ações do SDR</h3>
            <LeadActions lead={lead} meeting={activeMeeting?.meeting ?? null} />
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3">Timeline</h3>
            <LeadTimeline items={leadInteractions} />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3">Informações do cliente</h3>
            <form action={updateLeadAction.bind(null, lead.id)} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <EditableField name="name" label="Nome" defaultValue={lead.name} />
                <EditableField name="company" label="Empresa" defaultValue={lead.company ?? ""} />
                <EditableField name="role" label="Cargo" defaultValue={lead.role ?? ""} />
                <EditableField name="email" label="E-mail" defaultValue={lead.email ?? ""} type="email" />
                <EditableField name="phone" label="Telefone" defaultValue={lead.phone ?? ""} />
                <EditableField name="whatsapp" label="WhatsApp" defaultValue={lead.whatsapp ?? ""} />
              </div>
              <button type="submit" className="self-start rounded-lg bg-brand text-brand-ink text-sm font-medium px-4 py-1.5">
                Salvar alterações
              </button>
              <dl className="flex flex-col gap-2 text-sm border-t border-border pt-3">
                <Row label="Origem" value={lead.source} />
                <Row label="Criado em" value={formatDateTime(lead.createdAt)} />
                <Row label="Último contato" value={lead.lastContactAt ? formatDateTime(lead.lastContactAt) : "—"} />
              </dl>
            </form>
          </div>

          {activeMeeting && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-3">Reunião</h3>
              <dl className="flex flex-col gap-2 text-sm">
                <Row label="Data" value={formatDate(activeMeeting.meeting.scheduledAt)} />
                <Row label="Horário" value={formatTime(activeMeeting.meeting.scheduledAt)} />
                <Row label="SDR" value={activeMeeting.sdrName ?? "—"} />
                <Row label="Status" value={<StatusBadge status={activeMeeting.meeting.status} />} />
                <Row label="Score" value={<RiskBadge level={activeMeeting.meeting.riskLevel} score={activeMeeting.meeting.riskScore} />} />
                {activeMeeting.meeting.meetingLink && (
                  <Row
                    label="Link"
                    value={
                      <a href={activeMeeting.meeting.meetingLink} target="_blank" rel="noreferrer" className="text-brand-strong hover:underline flex items-center gap-1">
                        Acessar <ExternalLink size={12} />
                      </a>
                    }
                  />
                )}
              </dl>
              {(activeMeeting.meeting.rawTitle || activeMeeting.meeting.rawDescription) && (
                <details className="mt-3 border-t border-border pt-3">
                  <summary className="cursor-pointer text-xs font-medium text-muted hover:text-brand-strong">
                    Ver dados originais do evento (Google Calendar)
                  </summary>
                  <div className="mt-2 flex flex-col gap-1.5 text-xs">
                    {activeMeeting.meeting.rawTitle && (
                      <p><span className="text-muted">Título:</span> {activeMeeting.meeting.rawTitle}</p>
                    )}
                    {activeMeeting.meeting.rawDescription && (
                      <p className="whitespace-pre-wrap"><span className="text-muted">Descrição:</span> {activeMeeting.meeting.rawDescription}</p>
                    )}
                  </div>
                </details>
              )}
            </div>
          )}

          {leadMeetings.length > 1 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-3">Histórico de reuniões</h3>
              <div className="flex flex-col gap-2">
                {leadMeetings.map(({ meeting }) => (
                  <div key={meeting.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted">{formatDate(meeting.scheduledAt)} · {formatTime(meeting.scheduledAt)}</span>
                    <StatusBadge status={meeting.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="font-medium text-foreground text-right">{value || "—"}</dd>
    </div>
  );
}

function EditableField({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={label}
        className="rounded-lg border border-border px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand/40"
      />
    </label>
  );
}
