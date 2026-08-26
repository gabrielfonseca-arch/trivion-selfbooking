import Link from "next/link";
import { Bell, LogOut, Menu } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ROLE_LABEL } from "@/lib/labels";
import { logoutAction } from "@/actions/auth";
import type { SessionUser } from "@/lib/auth";
import { db } from "@/db";
import { notifications as notificationsTable } from "@/db/schema";
import { and, eq, isNull, or, desc } from "drizzle-orm";
import { formatRelativeToNow } from "@/lib/utils";
import { MobileNav } from "@/components/app/mobile-nav";
import { ActionMenu } from "@/components/app/action-menu";
import { QuickSearch } from "@/components/app/quick-search";
import { TrivionSymbol } from "@/components/brand/logo";

export async function Topbar({ user, title }: { user: SessionUser; title?: string }) {
  const unread = await db
    .select()
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.read, false),
        or(isNull(notificationsTable.userId), eq(notificationsTable.userId, user.id))
      )
    )
    .orderBy(desc(notificationsTable.createdAt))
    .limit(8);

  return (
    <header className="sticky top-0 z-20 bg-surface/90 backdrop-blur border-b border-border">
      <div className="flex items-center justify-between gap-4 px-4 lg:px-6 py-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <MobileNav role={user.role} />
          {/* No mobile o menu lateral some, então a marca fica aqui. */}
          <TrivionSymbol size={22} className="lg:hidden text-navy shrink-0" />
          <h1 className="text-sm font-semibold text-foreground truncate hidden sm:block lg:hidden xl:block">
            {title}
          </h1>
          <div className="hidden md:flex flex-1 justify-end lg:justify-start">
            <QuickSearch />
          </div>
        </div>


        <div className="flex items-center gap-3 shrink-0">
          <details className="relative">
            <summary className="list-none cursor-pointer relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100">
              <Bell size={18} />
              {unread.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center">
                  {unread.length}
                </span>
              )}
            </summary>
            <div className="absolute right-0 mt-2 w-80 card p-2 shadow-lg z-30">
              <p className="text-xs font-semibold text-muted px-2 py-1.5">Notificações</p>
              {unread.length === 0 && (
                <p className="text-sm text-muted px-2 py-4 text-center">Nenhuma notificação nova.</p>
              )}
              <div className="max-h-80 overflow-auto flex flex-col">
                {unread.map((n) => (
                  <div key={n.id} className="px-2 py-2 rounded-lg hover:bg-gray-50">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <p className="text-xs text-muted">{n.message}</p>
                    <p className="text-[10px] text-muted mt-0.5">{formatRelativeToNow(n.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          </details>

          <ActionMenu className="relative">
            <summary className="list-none cursor-pointer flex items-center gap-2">
              <Avatar name={user.name} color={user.avatarColor} size={32} />
            </summary>
            <div className="absolute right-0 mt-2 w-56 card p-2 shadow-lg z-30">
              <div className="px-2 py-2">
                <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted truncate">{ROLE_LABEL[user.role]}</p>
              </div>
              <div className="h-px bg-border my-1" />
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2 px-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <LogOut size={15} /> Sair
                </button>
              </form>
            </div>
          </ActionMenu>
        </div>
      </div>

      {/* No mobile não sobra espaço para a busca na mesma linha do menu e do
          avatar — ela ganha a própria faixa, em vez de sumir da tela. */}
      <div className="md:hidden px-4 pb-3">
        <QuickSearch />
      </div>
    </header>
  );
}

export function MenuIcon() {
  return <Menu size={20} />;
}
