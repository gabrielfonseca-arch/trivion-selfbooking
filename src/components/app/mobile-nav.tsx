"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";
import { Menu } from "lucide-react";
import { NAV_GROUPS } from "@/lib/nav";
import { ActionMenu } from "@/components/app/action-menu";

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <ActionMenu className="lg:hidden relative">
      <summary
        className="list-none cursor-pointer flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100"
        aria-label="Abrir menu"
      >
        <Menu size={19} />
      </summary>
      <div className="absolute left-0 mt-2 w-64 card p-2 shadow-lg z-30 max-h-[80vh] overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) =>
            (i.roles as readonly string[]).includes(role)
          );
          if (items.length === 0) return null;
          return (
            <div key={group.title} className="mb-2 last:mb-0">
              <p className="brand-eyebrow text-[9px] text-muted px-3 py-1.5">{group.title}</p>
              {items.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
                      active
                        ? "bg-brand/15 text-brand-strong"
                        : "text-foreground hover:bg-gray-50"
                    )}
                  >
                    <Icon size={16} strokeWidth={2} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </ActionMenu>
  );
}
