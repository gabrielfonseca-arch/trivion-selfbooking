import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL } from "@/lib/labels";
import { createUserAction, toggleUserStatusAction, updateUserRoleAction } from "@/actions/settings";

export default async function UsersSettingsPage() {
  await requireRole(["admin"]);
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Usuários</h2>
        <p className="text-sm text-muted mt-1">Administradores, coordenadores e SDRs com acesso ao sistema</p>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3">Novo usuário</h3>
        <form action={createUserAction} className="grid sm:grid-cols-4 gap-2">
          <input name="name" placeholder="Nome" required className="rounded-lg border border-border px-2.5 py-2 text-sm" />
          <input name="email" type="email" placeholder="E-mail" required className="rounded-lg border border-border px-2.5 py-2 text-sm" />
          <select name="role" className="rounded-lg border border-border px-2.5 py-2 text-sm">
            <option value="sdr">SDR</option>
            <option value="coordinator">Coordenador</option>
            <option value="admin">Administrador</option>
          </select>
          <button type="submit" className="rounded-lg bg-brand text-brand-ink text-sm font-medium py-2">Criar (senha padrão: trivion123)</button>
        </form>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted uppercase tracking-wide border-b border-border">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Perfil</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.name} size={28} color={u.avatarColor} />
                    <span className="font-medium">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{u.email}</td>
                <td className="px-4 py-3">
                  <RoleSelect userId={u.id} current={u.role} />
                </td>
                <td className="px-4 py-3">
                  <Badge className={u.status === "active" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-gray-100 text-gray-600 ring-gray-500/20"}>
                    {u.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <form action={toggleUserStatusAction.bind(null, u.id)}>
                    <button type="submit" className="text-xs font-medium text-brand-strong hover:underline">
                      {u.status === "active" ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoleSelect({ userId, current }: { userId: string; current: string }) {
  const action = updateUserRoleAction.bind(null, userId);
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        await action(String(formData.get("role")) as "admin" | "coordinator" | "sdr");
      }}
      className="flex items-center gap-1.5"
    >
      <select name="role" defaultValue={current} className="rounded-lg border border-border px-2 py-1 text-xs">
        <option value="sdr">SDR</option>
        <option value="coordinator">Coordenador</option>
        <option value="admin">Administrador</option>
      </select>
      <button type="submit" className="text-xs font-medium text-brand-strong hover:underline">Salvar</button>
    </form>
  );
}
