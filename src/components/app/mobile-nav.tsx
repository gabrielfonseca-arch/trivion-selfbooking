"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";
import { Menu } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "coordinator", "sdr"] },
  { href: "/self-bookings", label: "Self Bookings", roles: ["admin", "coordinator", "sdr"] },
  { href: "/agenda", label: "Agenda", roles: ["admin", "coordinator", "sdr"] },
  { href: "/tasks", label: "Minhas Tarefas", roles: ["admin", "coordinator", "sdr"] },
  { href: "/leads", label: "Leads", roles: ["admin", "coordinator", "sdr"] },
  { href: "/no-shows", label: "No-Shows", roles: ["admin", "coordinator", "sdr"] },
  { href: "/reports", label: "Relatórios", roles: ["admin", "coordinator"] },
  { href: "/performance", label: "Performance", roles: ["admin", "coordinator", "sdr"] },
  { href: "/scripts", label: "Scripts", roles: ["admin", "coordinator", "sdr"] },
  { href: "/settings", label: "Configurações", roles: ["admin", "coordinator"] },
] as const;

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <details className="lg:hidden relative">
      <summary className="list-none cursor-pointer flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100">
        <Menu size={19} />
      </summary>
      <div className="absolute left-0 mt-2 w-60 card p-2 shadow-lg z-30">
        {NAV.filter((item) => (item.roles as readonly string[]).includes(role)).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-lg px-3 py-2 text-sm font-medium",
              pathname.startsWith(item.href) ? "bg-brand/10 text-brand" : "text-foreground hover:bg-gray-50"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
