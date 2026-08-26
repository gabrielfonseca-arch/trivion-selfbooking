import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { riskFactors, riskThresholds } from "@/db/schema";
import { asc } from "drizzle-orm";
import { updateRiskFactorAction, updateRiskThresholdsAction } from "@/actions/settings";
import { ensureDefaultRiskConfig } from "@/lib/risk-score";

export default async function RiskScoreSettingsPage() {
  await requireRole(["admin"]);
  await ensureDefaultRiskConfig();

  const factors = await db.select().from(riskFactors).orderBy(asc(riskFactors.order));
  const [thresholds] = await db.select().from(riskThresholds).limit(1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Score de Risco</h2>
        <p className="text-sm text-muted mt-1">Fatores e limiares do algoritmo de risco de no-show (0–100)</p>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3">Classificação</h3>
        <form action={async (formData: FormData) => {
          "use server";
          await updateRiskThresholdsAction(Number(formData.get("lowMax")), Number(formData.get("mediumMax")));
        }} className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">🟢 Baixo risco (0 até)</label>
            <input type="number" name="lowMax" defaultValue={thresholds?.lowMax ?? 30} className="rounded-lg border border-border px-2.5 py-1.5 text-sm w-24" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">🟡 Médio risco (até)</label>
            <input type="number" name="mediumMax" defaultValue={thresholds?.mediumMax ?? 60} className="rounded-lg border border-border px-2.5 py-1.5 text-sm w-24" />
          </div>
          <p className="text-xs text-muted">🔴 Alto risco: acima disso</p>
          <button type="submit" className="rounded-lg bg-brand text-brand-ink text-sm font-medium px-4 py-2">Salvar</button>
        </form>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3">Fatores do score</h3>
        <div className="flex flex-col divide-y divide-border">
          {factors.map((f) => (
            <FactorRow key={f.id} id={f.id} label={f.label} points={f.points} active={f.active} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FactorRow({ id, label, points, active }: { id: string; label: string; points: number; active: boolean }) {
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        await updateRiskFactorAction(id, Number(formData.get("points")), formData.get("active") === "on");
      }}
      className="flex items-center justify-between gap-3 py-2.5"
    >
      <span className="text-sm flex-1">{label}</span>
      <input type="number" name="points" defaultValue={points} className="w-20 rounded-lg border border-border px-2 py-1 text-sm text-right" />
      <label className="flex items-center gap-1.5 text-xs text-muted">
        <input type="checkbox" name="active" defaultChecked={active} /> Ativo
      </label>
      <button type="submit" className="text-xs font-medium text-brand-strong hover:underline">Salvar</button>
    </form>
  );
}
