import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeToNow, formatTime, cn } from "@/lib/utils";
import { meetingUrgency } from "@/lib/risk-score";
import type { leads, meetings } from "@/db/schema";

type Lead = typeof leads.$inferSelect;
type Meeting = typeof meetings.$inferSelect;

const URGENCY_STYLE: Record<string, { emoji: string; classes: string }> = {
  critico: { emoji: "🔴", classes: "bg-red-50 border-red-200" },
  alto: { emoji: "🟠", classes: "bg-orange-50 border-orange-200" },
  medio: { emoji: "🟡", classes: "bg-amber-50 border-amber-200" },
  baixo: { emoji: "🟢", classes: "bg-emerald-50 border-emerald-200" },
};

export function RiskAlertItem({
  meeting,
  lead,
  sdrName,
  reasonHint,
}: {
  meeting: Meeting;
  lead: Lead;
  sdrName?: string | null;
  reasonHint?: string;
}) {
  const urgency = meetingUrgency(meeting);
  const style = URGENCY_STYLE[urgency.level];

  return (
    <Link
      href={`/leads/${lead.id}`}
      className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:brightness-95", style.classes)}
    >
      <Avatar name={lead.name} size={34} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold">{style.emoji} {urgency.label}</span>
        </div>
        <p className="text-sm font-medium text-foreground truncate">
          {lead.name} {lead.company ? `· ${lead.company}` : ""}
        </p>
        <p className="text-xs text-muted truncate">
          Reunião {formatRelativeToNow(meeting.scheduledAt)} ({formatTime(meeting.scheduledAt)})
          {sdrName ? ` · ${sdrName}` : ""} — {reasonHint ?? "sem confirmação"}
        </p>
      </div>
      <span className="text-sm font-semibold shrink-0 tabular-nums">{meeting.riskScore}</span>
    </Link>
  );
}
