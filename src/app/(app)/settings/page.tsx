import { requireRole } from "@/lib/auth";
import Link from "next/link";
import { Users, ListFilter, Gauge, Clock, Target, Plug } from "lucide-react";

const SECTIONS = [
  { href: "/settings/users", label: "Usuários", desc: "Gerencie administradores, coordenadores e SDRs", icon: Users, roles: ["admin"] },
  { href: "/settings/rules", label: "Regras de Self Booking", desc: "Defina como o sistema identifica um Self Booking", icon: ListFilter, roles: ["admin"] },
  { href: "/settings/risk-score", label: "Score de Risco", desc: "Ajuste os fatores e limiares do algoritmo de risco", icon: Gauge, roles: ["admin"] },
  { href: "/settings/cadence", label: "Cadência de Confirmação", desc: "Configure os intervalos da cadência de contato", icon: Clock, roles: ["admin"] },
  { href: "/settings/goals", label: "Metas", desc: "Metas de comparecimento, no-show, confirmação e tempo de contato", icon: Target, roles: ["admin", "coordinator"] },
  { href: "/settings/integrations", label: "Integrações", desc: "Conexão com o Google Calendar e agendas monitoradas", icon: Plug, roles: ["admin"] },
];

export default async function SettingsPage() {
  const user = await requireRole(["admin", "coordinator"]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Configurações</h2>
        <p className="text-sm text-muted mt-1">Área administrativa do sistema</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTIONS.filter((s) => s.roles.includes(user.role)).map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href} className="card p-5 hover:shadow-md transition-shadow flex flex-col gap-2">
              <div className="w-9 h-9 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                <Icon size={18} />
              </div>
              <p className="text-sm font-semibold text-foreground">{s.label}</p>
              <p className="text-xs text-muted">{s.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
