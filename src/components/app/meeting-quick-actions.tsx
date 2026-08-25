import {
  confirmMeetingAction,
  markUnconfirmedAction,
  markAttendedAction,
  markNoShowAction,
  cancelMeetingAction,
  rescheduleMeetingAction,
} from "@/actions/meetings";
import { NO_SHOW_REASON_LABEL } from "@/lib/labels";
import { MoreHorizontal, CheckCircle2, UserCheck, UserX, Ban, CalendarClock } from "lucide-react";
import type { meetings } from "@/db/schema";

type Meeting = typeof meetings.$inferSelect;

const TERMINAL = ["cancelado", "no_show", "compareceu", "realizada"];

/**
 * Menu de ações rápidas para uma reunião, pensado para caber numa linha de
 * tabela (Self Bookings, Leads): confirmar, marcar como compareceu, no-show
 * com motivo, cancelar ou remarcar sem precisar abrir a ficha do lead.
 */
export function MeetingQuickActions({ meeting }: { meeting: Meeting }) {
  if (TERMINAL.includes(meeting.status)) {
    return <span className="text-xs text-muted">—</span>;
  }

  return (
    <details className="relative">
      <summary
        className="list-none cursor-pointer flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 text-muted"
        title="Ações rápidas"
      >
        <MoreHorizontal size={16} />
      </summary>
      <div className="absolute right-0 z-30 mt-1 card p-2 w-64 shadow-lg flex flex-col gap-1 text-sm">
        <form action={confirmMeetingAction.bind(null, meeting.id)}>
          <button type="submit" className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-emerald-50 text-emerald-700 text-left">
            <CheckCircle2 size={14} /> Confirmar reunião
          </button>
        </form>
        {meeting.status === "confirmado" && (
          <form action={markUnconfirmedAction.bind(null, meeting.id)}>
            <button type="submit" className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 text-left">
              Marcar como não confirmado
            </button>
          </form>
        )}
        <form action={markAttendedAction.bind(null, meeting.id)}>
          <button type="submit" className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-teal-50 text-teal-700 text-left">
            <UserCheck size={14} /> Compareceu
          </button>
        </form>

        <div className="border-t border-border my-1" />

        <details>
          <summary className="list-none cursor-pointer flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-red-50 text-red-600">
            <UserX size={14} /> No-show
          </summary>
          <form
            action={async (formData: FormData) => {
              "use server";
              await markNoShowAction(meeting.id, String(formData.get("reason") || "outro"), String(formData.get("note") || ""));
            }}
            className="flex flex-col gap-1.5 mt-1.5 px-1"
          >
            <select name="reason" required className="rounded-lg border border-border px-2 py-1.5 text-xs">
              {Object.entries(NO_SHOW_REASON_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <textarea name="note" rows={2} placeholder="Observação (opcional)" className="rounded-lg border border-border px-2 py-1.5 text-xs" />
            <button type="submit" className="rounded-lg bg-red-600 text-white text-xs font-medium py-1.5">Registrar No-show</button>
          </form>
        </details>

        <details>
          <summary className="list-none cursor-pointer flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-gray-50">
            <CalendarClock size={14} /> Remarcar
          </summary>
          <form
            action={async (formData: FormData) => {
              "use server";
              await rescheduleMeetingAction(meeting.id, String(formData.get("newDateISO") || ""));
            }}
            className="flex flex-col gap-1.5 mt-1.5 px-1"
          >
            <input type="datetime-local" name="newDateISO" required className="rounded-lg border border-border px-2 py-1.5 text-xs" />
            <button type="submit" className="rounded-lg bg-brand text-white text-xs font-medium py-1.5">Salvar remarcação</button>
          </form>
        </details>

        <details>
          <summary className="list-none cursor-pointer flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 text-red-600">
            <Ban size={14} /> Cancelar
          </summary>
          <form
            action={async (formData: FormData) => {
              "use server";
              await cancelMeetingAction(meeting.id, String(formData.get("reason") || ""));
            }}
            className="flex flex-col gap-1.5 mt-1.5 px-1"
          >
            <textarea name="reason" rows={2} placeholder="Motivo do cancelamento" className="rounded-lg border border-border px-2 py-1.5 text-xs" />
            <button type="submit" className="rounded-lg bg-red-600 text-white text-xs font-medium py-1.5">Cancelar reunião</button>
          </form>
        </details>
      </div>
    </details>
  );
}
