import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, RiskBadge } from "@/components/ui/badge";
import { formatTime, formatDate, formatRelativeToNow } from "@/lib/utils";
import type { leads, meetings } from "@/db/schema";

type Lead = typeof leads.$inferSelect;
type Meeting = typeof meetings.$inferSelect;

export function MeetingItem({
  meeting,
  lead,
  sdrName,
  showDate = false,
}: {
  meeting: Meeting;
  lead: Lead;
  sdrName?: string | null;
  showDate?: boolean;
}) {
  return (
    <Link
      href={`/leads/${lead.id}`}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors"
    >
      <Avatar name={lead.name} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
          {lead.company && <span className="text-xs text-muted truncate">· {lead.company}</span>}
        </div>
        <p className="text-xs text-muted truncate">
          {showDate ? formatDate(meeting.scheduledAt) + " · " : ""}
          {formatTime(meeting.scheduledAt)} · {formatRelativeToNow(meeting.scheduledAt)}
          {sdrName ? ` · ${sdrName}` : ""}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <StatusBadge status={meeting.status} />
        <RiskBadge level={meeting.riskLevel} score={meeting.riskScore} />
      </div>
    </Link>
  );
}
