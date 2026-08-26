"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";
import { TrivionLockup } from "@/components/brand/logo";
import { NAV_GROUPS } from "@/lib/nav";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-[var(--sidebar-bg)] text-[var(--sidebar-fg)] min-h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-white/10">
        <Link href="/dashboard" className="block">
          <TrivionLockup descriptor="Self Booking" />
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) =>
            (i.roles as readonly string[]).includes(role)
          );
          if (items.length === 0) return null;

          return (
            <div key={group.title} className="flex flex-col gap-0.5">
              <p className="brand-eyebrow text-[9px] text-white/35 px-3 pb-1.5">{group.title}</p>
              {items.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.hint}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-[var(--sidebar-active)] text-white"
                        : "text-[var(--sidebar-fg)] hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {/* Marcador em verde limão: mostra de relance onde você está. */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full bg-brand transition-all",
                        active ? "h-5 opacity-100" : "h-0 opacity-0"
                      )}
                    />
                    <Icon
                      size={17}
                      strokeWidth={2}
                      className={active ? "text-brand" : undefined}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-white/10 text-[10px] text-white/40 leading-relaxed">
        Grupo Trivion
        <br />
        Aceleradora Comercial
      </div>
    </aside>
  );
}
