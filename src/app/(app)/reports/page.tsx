import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { meetings, interactions } from "@/db/schema";
import { and, gte, lte, eq } from "drizzle-orm";
import { getKpis, lastNDays } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { StatCard } from "@/components/ui/card";

export default async function ReportsPage() {
  await requireRole(["admin", "coordinator"]);
  const range = lastNDays(7);
  const kpis = await getKpis(range);

  const weekMeetings = await db
    .select()
    .from(meetings)
    .where(and(gte(meetings.scheduledAt, range.from), lte(meetings.scheduledAt, range.to)));

  const semResposta = new Set<string>();
  for (const m of weekMeetings) {
    const leadInteractions = await db.select().from(interactions).where(eq(interactions.leadId, m.leadId));
    const hasResponse = leadInteractions.some((i) => ["respondeu", "confirmou"].includes(i.result));
    if (!hasResponse) semResposta.add(m.leadId);
  }

  const noShowsAltoRisco = weekMeetings.filter((m) => m.status === "no_show" && m.riskLevel === "alto").length;
  const semConfirmacaoD1 = weekMeetings.filter(
    (m) => !["confirmado", "compareceu", "realizada"].includes(m.status)
  ).length;

  const recomendacoes: string[] = [];
  if (kpis.taxaNoShow > 10) recomendacoes.push("A taxa de no-show está acima de 10% — priorize a confirmação D-1 e ligações para leads de alto risco.");
  if (semResposta.size > weekMeetings.length * 0.3 && weekMeetings.length > 0) recomendacoes.push("Mais de 30% dos leads da semana não responderam a nenhum contato — revise a velocidade e o canal do primeiro contato.");
  if (semConfirmacaoD1 > weekMeetings.length * 0.4 && weekMeetings.length > 0) recomendacoes.push("Muitas reuniões sem confirmação — reforce a cadência de confirmação D-1 e D0.");
  if (recomendacoes.length === 0) recomendacoes.push("Operação dentro do esperado nesta semana. Continue monitorando os indicadores de risco diariamente.");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Relatório Semanal — Self Booking</h2>
        <p className="text-sm text-muted mt-1">{formatDate(range.from)} a {formatDate(range.to)}</p>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-4">Resultado</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Self Bookings" value={kpis.total} />
          <StatCard label="Confirmados" value={`${kpis.confirmados} (${kpis.taxaConfirmacao}%)`} />
          <StatCard label="Compareceram" value={`${kpis.compareceram} (${kpis.taxaComparecimento}%)`} tone="success" />
          <StatCard label="No-show" value={`${kpis.noShow} (${kpis.taxaNoShow}%)`} tone="danger" />
          <StatCard label="Cancelamentos" value={`${kpis.cancelamentos} (${kpis.taxaCancelamento}%)`} />
          <StatCard label="Remarcações" value={`${kpis.remarcacoes} (${kpis.taxaRemarcacao}%)`} />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3">Principais problemas</h3>
        <ul className="flex flex-col gap-2 text-sm text-foreground">
          <li className="rounded-lg bg-gray-50 px-3 py-2">{semResposta.size} lead(s) não responderam a nenhum contato.</li>
          <li className="rounded-lg bg-gray-50 px-3 py-2">{noShowsAltoRisco} no-show(s) eram classificados como alto risco.</li>
          <li className="rounded-lg bg-gray-50 px-3 py-2">{semConfirmacaoD1} reunião(ões) não obtiveram confirmação.</li>
        </ul>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3">Recomendação</h3>
        <div className="flex flex-col gap-2">
          {recomendacoes.map((r, i) => (
            <p key={i} className="text-sm text-foreground bg-brand/5 rounded-lg px-3 py-2.5">{r}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
