import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { cadenceSteps } from "@/db/schema";
import { asc } from "drizzle-orm";
import { updateCadenceStepAction } from "@/actions/settings";
import { ensureDefaultCadence } from "@/lib/tasks";

export default async function CadenceSettingsPage() {
  await requireRole(["admin"]);
  await ensureDefaultCadence();
  const steps = await db.select().from(cadenceSteps).orderBy(asc(cadenceSteps.order));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Cadência de Confirmação</h2>
        <p className="text-sm text-muted mt-1">Intervalos automáticos de contato após o Self Booking</p>
      </div>

      <div className="flex flex-col gap-3">
        {steps.map((s) => (
          <form
            key={s.id}
            action={async (formData: FormData) => {
              "use server";
              await updateCadenceStepAction(s.id, {
                offsetHoursFromMeeting: Number(formData.get("offsetHoursFromMeeting")),
                channelSuggestion: String(formData.get("channelSuggestion")),
                active: formData.get("active") === "on",
              });
            }}
            className="card p-4 flex items-center gap-3 flex-wrap"
          >
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-semibold">{s.label}</p>
              <p className="text-xs text-muted">{s.objective}</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted">Offset (horas antes da reunião; negativo = criado no ato)</label>
              <input type="number" name="offsetHoursFromMeeting" defaultValue={s.offsetHoursFromMeeting} className="w-28 rounded-lg border border-border px-2 py-1 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted">Canal sugerido</label>
              <select name="channelSuggestion" defaultValue={s.channelSuggestion ?? "whatsapp"} className="rounded-lg border border-border px-2 py-1 text-sm">
                <option value="whatsapp">WhatsApp</option>
                <option value="ligacao">Ligação</option>
                <option value="email">E-mail</option>
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" name="active" defaultChecked={s.active} /> Ativo
            </label>
            <button type="submit" className="text-xs font-medium text-brand hover:underline">Salvar</button>
          </form>
        ))}
      </div>
    </div>
  );
}
