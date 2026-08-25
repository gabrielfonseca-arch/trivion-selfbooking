import { CHANNEL_LABEL, RESULT_LABEL } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import type { interactions } from "@/db/schema";

type Interaction = typeof interactions.$inferSelect;

export function LeadTimeline({ items }: { items: Interaction[] }) {
  const sorted = [...items].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (sorted.length === 0) {
    return <p className="text-sm text-muted py-6 text-center">Nenhum evento registrado ainda.</p>;
  }

  return (
    <ol className="relative border-l border-border ml-2 flex flex-col gap-5 py-1">
      {sorted.map((item) => (
        <li key={item.id} className="ml-4">
          <div className="absolute -ml-[21px] mt-1 w-2.5 h-2.5 rounded-full bg-brand ring-4 ring-white" />
          <p className="text-xs text-muted">{formatDateTime(item.createdAt)}</p>
          <p className="text-sm font-medium text-foreground mt-0.5">{item.type}</p>
          <p className="text-xs text-muted mt-0.5">
            {CHANNEL_LABEL[item.channel]} · {RESULT_LABEL[item.result]}
          </p>
          {item.note && <p className="text-xs text-muted mt-1 bg-gray-50 rounded-lg px-2.5 py-1.5">{item.note}</p>}
        </li>
      ))}
    </ol>
  );
}
