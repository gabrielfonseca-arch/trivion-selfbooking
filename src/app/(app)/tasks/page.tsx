import { requireUser } from "@/lib/auth";
import { getTasksForUser } from "@/lib/queries";
import { TaskRow } from "@/components/app/task-row";
import { cleanupStaleTasksAction } from "@/actions/tasks";
import { Broom } from "lucide-react";

export default async function TasksPage() {
  const user = await requireUser();
  const data = await getTasksForUser(user.role === "sdr" ? user.id : undefined);

  const groups = [
    { key: "atrasadas", label: "🔴 Atrasadas", items: data.atrasadas },
    { key: "alta", label: "🟠 Prioridade alta", items: data.prioridadeAlta },
    { key: "hoje", label: "🟡 Para hoje", items: data.hoje },
    { key: "futuras", label: "🟢 Futuras", items: data.futuras },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Tarefas</h2>
          <p className="text-sm text-muted mt-1">{data.all.length} tarefa(s) pendente(s)</p>
        </div>
        {(user.role === "admin" || user.role === "coordinator") && (
          <form action={async () => { "use server"; await cleanupStaleTasksAction(); }}>
            <button
              type="submit"
              title="Cancela tarefas de cadência de reuniões que já passaram e nunca foram resolvidas"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-border text-sm font-medium px-3.5 py-2 hover:bg-gray-50"
            >
              <Broom size={15} /> Limpar tarefas de reuniões passadas
            </button>
          </form>
        )}
      </div>

      {groups.map((g) => (
        <div key={g.key} className="card p-5">
          <h3 className="text-sm font-semibold mb-3">{g.label} <span className="text-muted font-normal">({g.items.length})</span></h3>
          <div className="flex flex-col gap-2">
            {g.items.length === 0 && <p className="text-sm text-muted py-3 text-center">Nenhuma tarefa aqui.</p>}
            {g.items.map((t) => (
              <TaskRow key={t.task.id} task={t.task} lead={t.lead} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
