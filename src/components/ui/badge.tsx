import { cn } from "@/lib/utils";
import {
  MEETING_STATUS_COLOR,
  MEETING_STATUS_LABEL,
  RISK_LABEL,
  RISK_ICON,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
} from "@/lib/labels";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={MEETING_STATUS_COLOR[status] ?? "bg-gray-100 text-gray-600 ring-gray-500/20"}>
      {MEETING_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function RiskBadge({ level, score }: { level: string; score?: number }) {
  return (
    <Badge className={cn("ring-transparent", `risk-${level}`)}>
      <span>{RISK_ICON[level] ?? "⚪"}</span>
      <span>
        {RISK_LABEL[level] ?? level}
        {typeof score === "number" ? ` · ${score}` : ""}
      </span>
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge className={cn("ring-transparent", PRIORITY_COLOR[priority] ?? "bg-gray-100 text-gray-600")}>
      {PRIORITY_LABEL[priority] ?? priority}
    </Badge>
  );
}
