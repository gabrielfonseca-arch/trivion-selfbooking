import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { users, goals as goalsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSdrPerformance, lastNDays } from "@/lib/queries";
import { StatCard } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";

function GoalPill({ label, actual, target, unit, lowerIsBetter = false }: { label: string; actual: number; target: number; unit: string; lowerIsBetter?: boolean }) {
  const met = lowerIsBetter ? actual <= target : actual >= target;
  return (
    <div className={`rounded-lg px-3 py-2 text-xs flex items-center justify-between ${met ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
      <span>{label}</span>
      <span className="font-semibold">{actual}{unit} / meta {target}{unit}</span>
    </div>
  );
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = sp.periodo === "mes" ? 30 : sp.periodo === "trimestre" ? 90 : 7;

  const targetSdrId = user.role === "sdr" ? user.id : sp.sdr;
  const sdrList = await db.select().from(users).where(eq(users.role, "sdr"));
  const goalsRows = await db.select().from(goalsTable);
  const goalsMap = Object.fromEntries(goalsRows.map((g) => [g.key, g.targetValue]));

  const activeSdr = targetSdrId ? sdrList.find((s) => s.id === targetSdrId) ?? sdrList[0] : sdrList[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Performance</h2>
          <p className="text-sm text-muted mt-1">Indicadores individuais de cada SDR</p>
        </div>
        <form action="/performance" className="flex items-center gap-2">
          {user.role !== "sdr" && sdrList.length > 0 && (
            <select name="sdr" defaultValue={activeSdr?.id} className="rounded-lg border border-border px-2.5 py-2 text-sm">
              {sdrList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <select name="periodo" defaultValue={sp.periodo ?? "semana"} className="rounded-lg border border-border px-2.5 py-2 text-sm">
            <option value="semana">Esta semana</option>
            <option value="mes">Este mês</option>
            <option value="trimestre">Últimos 90 dias</option>
          </select>
          <button type="submit" className="rounded-lg bg-brand text-brand-ink text-sm font-medium px-3.5 py-2">Aplicar</button>
        </form>
      </div>

      {!activeSdr && <p className="text-sm text-muted">Nenhum SDR cadastrado ainda.</p>}

      {activeSdr && (
        <>
          <div className="flex items-center gap-3">
            <Avatar name={activeSdr.name} size={40} color={activeSdr.avatarColor} />
            <div>
              <p className="font-semibold text-foreground">{activeSdr.name}</p>
              <p className="text-xs text-muted">Performance SDR</p>
            </div>
          </div>

          <SdrPerformancePanel sdrId={activeSdr.id} days={period} goalsMap={goalsMap} />
        </>
      )}
    </div>
  );
}

async function SdrPerformancePanel({ sdrId, days, goalsMap }: { sdrId: string; days: number; goalsMap: Record<string, number> }) {
  const perf = await getSdrPerformance(sdrId, lastNDays(days));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Self Bookings recebidos" value={perf.selfBookingsRecebidos} />
        <StatCard label="Leads trabalhados" value={perf.leadsTrabalhados} />
        <StatCard label="Contatos realizados" value={perf.contatosRealizados} />
        <StatCard label="Confirmações" value={perf.confirmacoes} />
        <StatCard label="Comparecimentos" value={perf.comparecimentos} tone="success" />
        <StatCard label="No-shows" value={perf.noShows} tone="danger" />
        <StatCard label="Remarcações" value={perf.remarcacoes} />
        <StatCard label="Taxa de recuperação" value={`${perf.taxaRecuperacao}%`} />
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3">Metas vs. resultado</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <GoalPill label="Taxa de comparecimento" actual={perf.taxaComparecimento} target={goalsMap["attendance_rate"] ?? 95} unit="%" />
          <GoalPill label="Taxa de no-show" actual={perf.taxaNoShow} target={goalsMap["no_show_rate"] ?? 5} unit="%" lowerIsBetter />
          <GoalPill label="Taxa de confirmação" actual={perf.taxaConfirmacao} target={goalsMap["confirmation_rate"] ?? 90} unit="%" />
          <GoalPill
            label="Tempo médio até 1º contato"
            actual={perf.tempoMedioPrimeiroContatoMin ?? 0}
            target={goalsMap["first_contact_minutes"] ?? 5}
            unit=" min"
            lowerIsBetter
          />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3">Outros indicadores</h3>
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Tempo médio até 1º contato</dt><dd className="font-medium">{perf.tempoMedioPrimeiroContatoMin != null ? `${perf.tempoMedioPrimeiroContatoMin} min` : "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Tentativas médias por lead</dt><dd className="font-medium">{perf.tentativasMediasPorLead}</dd></div>
        </dl>
      </div>
    </div>
  );
}
