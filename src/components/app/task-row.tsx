import Link from "next/link";
import { PriorityBadge } from "@/components/ui/badge";
import { formatRelativeToNow, formatDateTime, isOverdue, cn } from "@/lib/utils";
import { completeTaskAction, postponeTaskAction } from "@/actions/tasks";
import { CheckCircle2, Clock } from "lucide-react";
import { WhatsAppButton } from "@/components/app/whatsapp-button";
import type { tasks, leads } from "@/db/schema";

type Task = typeof tasks.$inferSelect;
type Lead = typeof leads.$inferSelect;

export function TaskRow({ task, lead }: { task: Task; lead?: Lead | null }) {
  const overdue = isOverdue(task.dueAt);
  const complete = completeTaskAction.bind(null, task.id);
  const postpone = postponeTaskAction.bind(null, task.id, 24);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground">{task.title}</p>
          <PriorityBadge priority={task.priority} />
        </div>
        <p className={cn("text-xs mt-0.5", overdue ? "text-red-600 font-medium" : "text-muted")}>
          {overdue ? "Atrasada — " : "Prazo "}
          {formatDateTime(task.dueAt)} ({formatRelativeToNow(task.dueAt)})
          {lead ? ` · ${lead.name}` : ""}
        </p>
        {task.note && <p className="text-xs text-muted mt-0.5 line-clamp-1">{task.note}</p>}
      </div>
      {/* Ações com o nome escrito, não só ícone: nesta tela o usuário decide
          rápido entre concluir e adiar, e adivinhar o que cada ícone faz custa
          mais do que o espaço que o rótulo ocupa. */}
      <div className="flex items-center gap-1.5 shrink-0">
        {lead?.whatsapp || lead?.phone ? (
          <WhatsAppButton lead={lead} />
        ) : null}
        {lead && (
          <Link
            href={`/leads/${lead.id}`}
            className="hidden sm:inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-strong hover:bg-brand/10"
          >
            Abrir lead
          </Link>
        )}
        <form action={postpone}>
          <button
            type="submit"
            title="Empurra o prazo desta tarefa em 24 horas"
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-gray-100 whitespace-nowrap"
          >
            <Clock size={14} /> Adiar 24h
          </button>
        </form>
        <form action={complete}>
          <button
            type="submit"
            title="Marca esta tarefa como concluída"
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 px-2.5 py-1.5 text-xs font-medium hover:bg-emerald-100 whitespace-nowrap"
          >
            <CheckCircle2 size={14} /> Concluir
          </button>
        </form>
      </div>
    </div>
  );
}
