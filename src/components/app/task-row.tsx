import Link from "next/link";
import { PriorityBadge } from "@/components/ui/badge";
import { formatRelativeToNow, formatDateTime, cn } from "@/lib/utils";
import { completeTaskAction, postponeTaskAction } from "@/actions/tasks";
import { CheckCircle2, Clock } from "lucide-react";
import type { tasks, leads } from "@/db/schema";

type Task = typeof tasks.$inferSelect;
type Lead = typeof leads.$inferSelect;

export function TaskRow({ task, lead }: { task: Task; lead?: Lead | null }) {
  const overdue = task.dueAt.getTime() < Date.now();
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
      <div className="flex items-center gap-1.5 shrink-0">
        {lead && (
          <Link
            href={`/leads/${lead.id}`}
            className="text-xs font-medium text-brand hover:underline px-2 py-1.5"
          >
            Abrir lead
          </Link>
        )}
        <form action={postpone}>
          <button
            type="submit"
            title="Adiar 24h"
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 text-muted"
          >
            <Clock size={16} />
          </button>
        </form>
        <form action={complete}>
          <button
            type="submit"
            title="Concluir"
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-emerald-50 text-emerald-600"
          >
            <CheckCircle2 size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
