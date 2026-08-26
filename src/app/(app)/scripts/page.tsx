import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { scripts } from "@/db/schema";
import { asc } from "drizzle-orm";
import { SCRIPT_CATEGORY_LABEL } from "@/lib/labels";
import { updateScriptAction, createScriptAction } from "@/actions/settings";
import { Pencil } from "lucide-react";

export default async function ScriptsPage() {
  const user = await requireUser();
  const canEdit = user.role === "admin" || user.role === "coordinator";
  const rows = await db.select().from(scripts).orderBy(asc(scripts.category));

  const grouped = new Map<string, typeof rows>();
  for (const s of rows) {
    if (!grouped.has(s.category)) grouped.set(s.category, []);
    grouped.get(s.category)!.push(s);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Scripts</h2>
        <p className="text-sm text-muted mt-1">Biblioteca de mensagens por categoria da cadência</p>
      </div>

      {Array.from(grouped.entries()).map(([category, items]) => (
        <div key={category} className="card p-5">
          <h3 className="text-sm font-semibold mb-3">{SCRIPT_CATEGORY_LABEL[category] ?? category}</h3>
          <div className="flex flex-col gap-3">
            {items.map((s) => (
              <div key={s.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-medium">{s.title}</p>
                  {canEdit && (
                    <details className="relative">
                      <summary className="list-none cursor-pointer text-muted hover:text-brand-strong"><Pencil size={14} /></summary>
                      <div className="absolute right-0 z-20 mt-2 card p-3 w-80 shadow-lg">
                        <ScriptEditForm scriptId={s.id} content={s.content} />
                      </div>
                    </details>
                  )}
                </div>
                <p className="text-xs text-muted whitespace-pre-line">{s.content}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {canEdit && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3">Adicionar novo script</h3>
          <form action={createScriptAction} className="flex flex-col gap-2 max-w-lg">
            <select name="category" className="rounded-lg border border-border px-2.5 py-1.5 text-sm">
              {Object.entries(SCRIPT_CATEGORY_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <input name="title" placeholder="Título" required className="rounded-lg border border-border px-2.5 py-1.5 text-sm" />
            <textarea name="content" placeholder="Conteúdo" rows={3} required className="rounded-lg border border-border px-2.5 py-1.5 text-sm" />
            <button type="submit" className="rounded-lg bg-brand text-brand-ink text-sm font-medium py-1.5 w-fit px-4">Adicionar</button>
          </form>
        </div>
      )}
    </div>
  );
}

function ScriptEditForm({ scriptId, content }: { scriptId: string; content: string }) {
  const action = updateScriptAction.bind(null, scriptId);
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        await action(String(formData.get("content") || ""));
      }}
      className="flex flex-col gap-2"
    >
      <textarea name="content" defaultValue={content} rows={5} className="rounded-lg border border-border px-2.5 py-1.5 text-sm" />
      <button type="submit" className="rounded-lg bg-brand text-brand-ink text-sm font-medium py-1.5">Salvar</button>
    </form>
  );
}
