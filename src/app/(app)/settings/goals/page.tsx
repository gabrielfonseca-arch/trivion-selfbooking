import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { goals } from "@/db/schema";
import { updateGoalAction } from "@/actions/settings";

export default async function GoalsSettingsPage() {
  await requireRole(["admin", "coordinator"]);
  const rows = await db.select().from(goals);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Metas</h2>
        <p className="text-sm text-muted mt-1">Metas de referência exibidas em Performance</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {rows.map((g) => (
          <form
            key={g.id}
            action={async (formData: FormData) => {
              "use server";
              await updateGoalAction(g.id, Number(formData.get("targetValue")));
            }}
            className="card p-4 flex items-center justify-between gap-3"
          >
            <span className="text-sm font-medium">{g.label}</span>
            <div className="flex items-center gap-1.5">
              <input type="number" name="targetValue" defaultValue={g.targetValue} className="w-20 rounded-lg border border-border px-2 py-1 text-sm text-right" />
              <span className="text-xs text-muted">{g.unit}</span>
              <button type="submit" className="text-xs font-medium text-brand hover:underline ml-1">Salvar</button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}
