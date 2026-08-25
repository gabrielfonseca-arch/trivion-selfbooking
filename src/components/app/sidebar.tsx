"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";
import {
  LayoutDashboard,
  CalendarClock,
  CalendarDays,
  ListChecks,
  Users,
  AlertTriangle,
  FileBarChart,
  TrendingUp,
  MessagesSquare,
  Settings,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "coordinator", "sdr"] },
  { href: "/self-bookings", label: "Self Bookings", icon: CalendarClock, roles: ["admin", "coordinator", "sdr"] },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, roles: ["admin", "coordinator", "sdr"] },
  { href: "/tasks", label: "Minhas Tarefas", icon: ListChecks, roles: ["admin", "coordinator", "sdr"] },
  { href: "/leads", label: "Leads", icon: Users, roles: ["admin", "coordinator", "sdr"] },
  { href: "/no-shows", label: "No-Shows", icon: AlertTriangle, roles: ["admin", "coordinator", "sdr"] },
  { href: "/reports", label: "Relatórios", icon: FileBarChart, roles: ["admin", "coordinator"] },
  { href: "/performance", label: "Performance", icon: TrendingUp, roles: ["admin", "coordinator", "sdr"] },
  { href: "/scripts", label: "Scripts", icon: MessagesSquare, roles: ["admin", "coordinator", "sdr"] },
  { href: "/settings", label: "Configurações", icon: Settings, roles: ["admin", "coordinator"] },
] as const;

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-[var(--sidebar-bg)] text-[var(--sidebar-fg)] min-h-screen sticky top-0">
      <div className="px-5 py-6 flex items-center gap-2.5 border-b border-white/5">
        <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center text-white font-bold">
          T
        </div>
        <div>
          <p className="text-white text-sm font-semibold leading-tight">TRIVION</p>
          <p className="text-[10px] uppercase tracking-wider text-[var(--sidebar-fg)]">Self Booking</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {NAV.filter((item) => (item.roles as readonly string[]).includes(role)).map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--sidebar-active)] text-white"
                  : "text-[var(--sidebar-fg)] hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon size={17} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-white/5 text-[10px] text-[var(--sidebar-fg)]">
        Grupo Trivion · Aceleradora Comercial
      </div>
    </aside>
  );
}
