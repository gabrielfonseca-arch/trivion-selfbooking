import { requireUser } from "@/lib/auth";
import { getTasksForUser } from "@/lib/queries";
import { TaskRow } from "@/components/app/task-row";

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
      <div>
        <h2 className="text-xl font-semibold text-foreground">Minhas Tarefas</h2>
        <p className="text-sm text-muted mt-1">{data.all.length} tarefa(s) pendente(s)</p>
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
