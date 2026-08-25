import { requireUser } from "@/lib/auth";
import { getNoShowBreakdown, lastNDays, getInsights } from "@/lib/queries";
import { StatCard } from "@/components/ui/card";
import { NO_SHOW_REASON_LABEL } from "@/lib/labels";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { NoShowEvolutionChart, HorizontalBarChart } from "@/components/app/charts";

function Bars({ data, colorClass = "bg-red-500" }: { data: { key: string; rate: number; total: number }[]; colorClass?: string }) {
  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => (
        <div key={d.key} className="flex items-center gap-3">
          <div className="w-28 text-xs text-muted shrink-0 truncate">{d.key}</div>
          <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${colorClass} rounded-full`} style={{ width: `${Math.min(d.rate, 100)}%` }} />
          </div>
          <div className="w-20 text-xs text-muted text-right shrink-0">{d.rate}% ({d.total})</div>
        </div>
      ))}
      {data.length === 0 && <p className="text-sm text-muted py-3 text-center">Sem dados suficientes ainda.</p>}
    </div>
  );
}

export default async function NoShowsPage() {
  await requireUser();
  const [data, insights] = await Promise.all([getNoShowBreakdown(lastNDays(90)), getInsights()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Controle de No-Show</h2>
        <p className="text-sm text-muted mt-1">Últimos 90 dias — análise para prevenção de no-show</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="No-show total" value={data.totalNoShow} tone="danger" icon={<AlertTriangle size={16} className="text-red-600" />} />
        <StatCard label="Taxa de no-show" value={`${data.taxaNoShow}%`} tone="danger" icon={<TrendingDown size={16} className="text-red-600" />} />
        <StatCard label="Reuniões fechadas" value={data.totalFechadas} />
        <StatCard label="Taxa de comparecimento" value={`${data.taxaComparecimento}%`} tone="success" icon={<TrendingUp size={16} className="text-emerald-600" />} />
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-4">Evolução do no-show (8 semanas)</h3>
        <NoShowEvolutionChart data={data.evolution} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4">No-show por SDR</h3>
          <Bars data={data.porSdr} />
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4">No-show por nível de risco</h3>
          <Bars data={data.porRisco} colorClass="bg-orange-500" />
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4">No-show por dia da semana</h3>
          <Bars data={data.porDiaSemana} colorClass="bg-purple-500" />
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4">No-show por horário</h3>
          <Bars data={data.porHorario} colorClass="bg-blue-500" />
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4">No-show por antecedência do agendamento</h3>
          <Bars data={data.porAntecedencia} colorClass="bg-teal-600" />
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4">Motivos de no-show</h3>
          <HorizontalBarChart
            data={data.porMotivo.map((m) => ({ motivo: NO_SHOW_REASON_LABEL[m.key] ?? m.key, total: m.value }))}
          />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3">🧠 Análise Inteligente</h3>
        <div className="flex flex-col gap-2">
          {insights.map((insight, i) => (
            <p key={i} className="text-sm text-foreground bg-brand/5 rounded-lg px-3 py-2.5">{insight}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
