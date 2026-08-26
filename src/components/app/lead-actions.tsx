import {
  confirmMeetingAction,
  markUnconfirmedAction,
  rescheduleMeetingAction,
  cancelMeetingAction,
  markAttendedAction,
  markNoShowAction,
  advanceRecoveryStageAction,
  markRecoveredAction,
} from "@/actions/meetings";
import { registerInteractionAction } from "@/actions/interactions";
import { NO_SHOW_REASON_LABEL, RECOVERY_STAGE_LABEL } from "@/lib/labels";
import { Phone, MessageCircle, CheckCircle2, XCircle, CalendarClock, Ban, UserCheck, UserX, StickyNote } from "lucide-react";
import { ActionMenu } from "@/components/app/action-menu";
import type { leads, meetings } from "@/db/schema";

type Lead = typeof leads.$inferSelect;
type Meeting = typeof meetings.$inferSelect;

function waLink(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

export function LeadActions({ lead, meeting }: { lead: Lead; meeting: Meeting | null }) {
  const wa = waLink(lead.whatsapp || lead.phone);
  const canActOnMeeting = meeting && !["cancelado", "no_show", "compareceu", "realizada"].includes(meeting.status);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium px-3.5 py-2 hover:bg-emerald-700">
            <MessageCircle size={15} /> WhatsApp
          </a>
        )}
        {lead.phone && (
          <a href={`tel:${lead.phone.replace(/\D/g, "")}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-border text-sm font-medium px-3.5 py-2 hover:bg-gray-50">
            <Phone size={15} /> Ligar
          </a>
        )}

        {meeting && canActOnMeeting && (
          <>
            <form action={confirmMeetingAction.bind(null, meeting.id)}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-brand text-brand-ink text-sm font-medium px-3.5 py-2 hover:bg-brand-dark">
                <CheckCircle2 size={15} /> Confirmar reunião
              </button>
            </form>
            <form action={markUnconfirmedAction.bind(null, meeting.id)}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-border text-sm font-medium px-3.5 py-2 hover:bg-gray-50">
                <XCircle size={15} /> Não confirmado
              </button>
            </form>
            <form action={markAttendedAction.bind(null, meeting.id)}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 text-white text-sm font-medium px-3.5 py-2 hover:bg-teal-700">
                <UserCheck size={15} /> Compareceu
              </button>
            </form>
          </>
        )}
      </div>

      {meeting && canActOnMeeting && (
        <div className="flex flex-wrap gap-2">
          <ActionMenu className="relative">
            <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-white border border-border text-sm font-medium px-3.5 py-2 hover:bg-gray-50">
              <CalendarClock size={15} /> Remarcar
            </summary>
            <RescheduleForm meetingId={meeting.id} />
          </ActionMenu>

          <ActionMenu className="relative">
            <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-white border border-border text-sm font-medium px-3.5 py-2 hover:bg-gray-50 text-red-600">
              <Ban size={15} /> Cancelar
            </summary>
            <CancelForm meetingId={meeting.id} />
          </ActionMenu>

          <ActionMenu className="relative">
            <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-white border border-border text-sm font-medium px-3.5 py-2 hover:bg-gray-50 text-red-600">
              <UserX size={15} /> No-show
            </summary>
            <NoShowForm meetingId={meeting.id} />
          </ActionMenu>
        </div>
      )}

      <ActionMenu className="relative">
        <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-brand/10 text-brand-strong text-sm font-medium px-3.5 py-2 hover:bg-brand/20 w-fit">
          <StickyNote size={15} /> Registrar interação / observação
        </summary>
        <InteractionForm leadId={lead.id} meetingId={meeting?.id ?? null} />
      </ActionMenu>

      {meeting && meeting.recoveryStage !== "nenhuma" && meeting.recoveryStage !== "recuperado" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex flex-col gap-2">
          <p className="text-sm font-medium text-amber-800">
            Workflow de recuperação: {RECOVERY_STAGE_LABEL[meeting.recoveryStage]} · {meeting.recoveryAttempts} tentativa(s)
          </p>
          <div className="flex gap-2">
            <form action={advanceRecoveryStageAction.bind(null, meeting.id, "Tentativa registrada")}>
              <button type="submit" className="rounded-lg bg-amber-600 text-white text-xs font-medium px-3 py-1.5">Registrar nova tentativa</button>
            </form>
            <form action={markRecoveredAction.bind(null, meeting.id)}>
              <button type="submit" className="rounded-lg bg-emerald-600 text-white text-xs font-medium px-3 py-1.5">Marcar como recuperado</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function RescheduleForm({ meetingId }: { meetingId: string }) {
  const action = rescheduleMeetingAction.bind(null, meetingId);
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        await action(String(formData.get("newDateISO") || ""));
      }}
      className="absolute z-20 mt-2 card p-3 w-72 flex flex-col gap-2 shadow-lg"
    >
      <label className="text-xs font-medium text-muted">Nova data e horário</label>
      <input type="datetime-local" name="newDateISO" required className="rounded-lg border border-border px-2.5 py-1.5 text-sm" />
      <button type="submit" className="rounded-lg bg-brand text-brand-ink text-sm font-medium py-1.5">Salvar remarcação</button>
    </form>
  );
}

function CancelForm({ meetingId }: { meetingId: string }) {
  const action = cancelMeetingAction.bind(null, meetingId);
  return (
    <form action={async (formData: FormData) => {
      "use server";
      await action(String(formData.get("reason") || ""));
    }} className="absolute z-20 mt-2 card p-3 w-72 flex flex-col gap-2 shadow-lg">
      <label className="text-xs font-medium text-muted">Motivo do cancelamento</label>
      <textarea name="reason" rows={3} className="rounded-lg border border-border px-2.5 py-1.5 text-sm" placeholder="Ex: cliente sem interesse no momento" />
      <button type="submit" className="rounded-lg bg-red-600 text-white text-sm font-medium py-1.5">Cancelar reunião</button>
    </form>
  );
}

function NoShowForm({ meetingId }: { meetingId: string }) {
  const action = markNoShowAction.bind(null, meetingId);
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        await action(String(formData.get("reason") || "outro"), String(formData.get("note") || ""));
      }}
      className="absolute z-20 mt-2 card p-3 w-72 flex flex-col gap-2 shadow-lg"
    >
      <label className="text-xs font-medium text-muted">Motivo do no-show</label>
      <select name="reason" required className="rounded-lg border border-border px-2.5 py-1.5 text-sm">
        {Object.entries(NO_SHOW_REASON_LABEL).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
      <textarea name="note" rows={2} placeholder="Observação (opcional)" className="rounded-lg border border-border px-2.5 py-1.5 text-sm" />
      <button type="submit" className="rounded-lg bg-red-600 text-white text-sm font-medium py-1.5">Registrar No-show</button>
    </form>
  );
}

function InteractionForm({ leadId, meetingId }: { leadId: string; meetingId: string | null }) {
  return (
    <form action={registerInteractionAction} className="absolute z-20 mt-2 card p-3 w-80 flex flex-col gap-2 shadow-lg">
      <input type="hidden" name="leadId" value={leadId} />
      {meetingId && <input type="hidden" name="meetingId" value={meetingId} />}
      <div className="grid grid-cols-2 gap-2">
        <select name="channel" className="rounded-lg border border-border px-2.5 py-1.5 text-sm">
          <option value="whatsapp">WhatsApp</option>
          <option value="ligacao">Ligação</option>
          <option value="email">E-mail</option>
          <option value="sistema">Observação interna</option>
          <option value="outro">Outro</option>
        </select>
        <select name="result" className="rounded-lg border border-border px-2.5 py-1.5 text-sm">
          <option value="neutro">Neutro</option>
          <option value="respondeu">Respondeu</option>
          <option value="confirmou">Confirmou</option>
          <option value="sem_resposta">Sem resposta</option>
          <option value="pediu_remarcar">Pediu remarcar</option>
          <option value="cancelou">Cancelou</option>
        </select>
      </div>
      <input name="type" placeholder="Tipo (ex: Primeiro contato)" required className="rounded-lg border border-border px-2.5 py-1.5 text-sm" />
      <textarea name="note" rows={3} placeholder="Observação" className="rounded-lg border border-border px-2.5 py-1.5 text-sm" />
      <button type="submit" className="rounded-lg bg-brand text-brand-ink text-sm font-medium py-1.5">Salvar</button>
    </form>
  );
}
