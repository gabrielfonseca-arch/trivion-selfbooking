"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Role = "admin" | "coordinator" | "sdr";

const GROUPS: { title: string; items: { href: string; label: string; roles: Role[] }[] }[] = [
  {
    title: "Integrações e Agendas",
    items: [{ href: "/settings/integrations", label: "Integrações", roles: ["admin"] }],
  },
  {
    title: "Regras e Automação",
    items: [
      { href: "/settings/rules", label: "Regras de Self Booking", roles: ["admin"] },
      { href: "/settings/risk-score", label: "Score de Risco", roles: ["admin"] },
      { href: "/settings/cadence", label: "Cadência de Confirmação", roles: ["admin"] },
    ],
  },
  {
    title: "Equipe e Metas",
    items: [
      { href: "/settings/users", label: "Usuários", roles: ["admin"] },
      { href: "/settings/goals", label: "Metas", roles: ["admin", "coordinator"] },
    ],
  },
];

export function SettingsTabs({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-1 border-b border-border overflow-x-auto">
      <div className="flex items-start gap-6">
        {GROUPS.map((group) => {
          const items = group.items.filter((i) => i.roles.includes(role));
          if (items.length === 0) return null;
          return (
            <div key={group.title} className="flex flex-col gap-1.5 pb-2">
              <span className="text-[10px] uppercase tracking-wider text-muted whitespace-nowrap px-1">
                {group.title}
              </span>
              <div className="flex items-center gap-1">
                {items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                        active ? "bg-brand text-brand-ink" : "bg-gray-100 text-muted hover:bg-gray-200"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
