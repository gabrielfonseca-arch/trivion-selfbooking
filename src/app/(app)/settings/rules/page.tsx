import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { selfBookingRules, calendarSources } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { createRuleAction, toggleRuleAction } from "@/actions/settings";

export default async function RulesSettingsPage() {
  await requireRole(["admin"]);
  const rules = await db.select().from(selfBookingRules);
  const sources = await db.select().from(calendarSources);
  const sourceMap = Object.fromEntries(sources.map((s) => [s.id, s.label]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Regras de Self Booking</h2>
        <p className="text-sm text-muted mt-1">
          Defina como o sistema identifica um evento do Google Calendar como Self Booking. Eventos com prefixo
          &quot;SA&quot; ou &quot;SL&quot; no título nunca contam (são agendamentos feitos pelo próprio SDR). Sem
          regras ativas, o padrão é considerar Self Booking todo evento no formato &quot;cliente e closer&quot;
          (ex: &quot;Patricia e Felipe Paiva&quot;) — o que distingue de reuniões internas (onboarding, treinamento
          etc.) na mesma agenda.
        </p>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3">Nova regra</h3>
        <form action={createRuleAction} className="grid sm:grid-cols-2 gap-2">
          <input name="name" placeholder="Nome da regra" required className="rounded-lg border border-border px-2.5 py-2 text-sm sm:col-span-2" />
          <select name="calendarSourceId" className="rounded-lg border border-border px-2.5 py-2 text-sm">
            <option value="">Qualquer agenda monitorada</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <input name="attendeeEmailPattern" placeholder="Padrão de e-mail (ex: *@* ou domínio)" className="rounded-lg border border-border px-2.5 py-2 text-sm" />
          <input name="titleKeywords" placeholder="Palavras-chave no título, separadas por vírgula" className="rounded-lg border border-border px-2.5 py-2 text-sm sm:col-span-2" />
          <input name="meetingTypeMatch" placeholder="Tipo de reunião (opcional)" className="rounded-lg border border-border px-2.5 py-2 text-sm" />
          <input name="responsibleMatch" placeholder="Responsável (opcional)" className="rounded-lg border border-border px-2.5 py-2 text-sm" />
          <button type="submit" className="rounded-lg bg-brand text-white text-sm font-medium py-2 sm:col-span-2">Criar regra</button>
        </form>
      </div>

      <div className="flex flex-col gap-3">
        {rules.map((r) => (
          <div key={r.id} className="card p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{r.name}</p>
                <Badge className={r.active ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-gray-100 text-gray-600 ring-gray-500/20"}>
                  {r.active ? "Ativa" : "Inativa"}
                </Badge>
              </div>
              <p className="text-xs text-muted mt-1">
                Agenda: {r.calendarSourceId ? sourceMap[r.calendarSourceId] ?? "—" : "Qualquer"} ·
                {" "}Palavras-chave: {r.titleKeywords || "—"} · Padrão e-mail: {r.attendeeEmailPattern || "—"}
              </p>
            </div>
            <form action={toggleRuleAction.bind(null, r.id)}>
              <button type="submit" className="text-xs font-medium text-brand hover:underline">
                {r.active ? "Desativar" : "Ativar"}
              </button>
            </form>
          </div>
        ))}
        {rules.length === 0 && (
          <p className="text-sm text-muted">
            Nenhuma regra cadastrada — usando o padrão &quot;cliente e closer&quot; no título (excluindo
            agendamentos com prefixo SA/SL).
          </p>
        )}
      </div>
    </div>
  );
}
