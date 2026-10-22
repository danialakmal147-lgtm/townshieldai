import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InspectionStatus, ReadinessStatus } from "@/lib/townshield/scoring";
import type { AuditKind, Condition, Criticality, Priority, WorkOrderStatus } from "@/lib/townshield/types";

export const READINESS_LABEL: Record<ReadinessStatus, string> = {
  critical: "Critical exception",
  at_risk: "At risk",
  attention: "Needs attention",
  ready: "Ready",
};

const READINESS_VARIANT = {
  critical: "critical",
  at_risk: "critical",
  attention: "warning",
  ready: "success",
} as const;

const READINESS_STROKE: Record<ReadinessStatus, string> = {
  critical: "stroke-critical",
  at_risk: "stroke-critical",
  attention: "stroke-warning",
  ready: "stroke-success",
};

const READINESS_TEXT: Record<ReadinessStatus, string> = {
  critical: "text-critical",
  at_risk: "text-critical",
  attention: "text-warning",
  ready: "text-success",
};

export function readinessText(s: ReadinessStatus) {
  return READINESS_TEXT[s];
}

export function ReadinessBadge({ status }: { status: ReadinessStatus }) {
  return (
    <Badge variant={READINESS_VARIANT[status]}>
      {status === "critical" && <span className="size-1.5 rounded-full bg-critical animate-signal" />}
      {READINESS_LABEL[status]}
    </Badge>
  );
}

export function ScoreRing({
  score,
  status,
  size = 160,
  stroke = 12,
  label = "Readiness",
}: {
  score: number;
  status: ReadinessStatus;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className={cn("fill-none transition-all duration-700", READINESS_STROKE[status])}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn("font-mono font-semibold tabular-nums leading-none", READINESS_TEXT[status])}
          style={{ fontSize: size * 0.3 }}
        >
          {score}
        </span>
        {size >= 120 && <span className="mt-1 eyebrow text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

export function ConditionBadge({ condition }: { condition: Condition }) {
  if (condition === "fault") return <Badge variant="critical">Fault</Badge>;
  if (condition === "degraded") return <Badge variant="warning">Degraded</Badge>;
  return <Badge variant="success">OK</Badge>;
}

export function InspectionBadge({ status, days }: { status: InspectionStatus; days: number }) {
  if (status === "overdue") return <Badge variant="critical">Overdue</Badge>;
  if (status === "grace") return <Badge variant="warning">Overdue · grace</Badge>;
  if (status === "due_soon") return <Badge variant="info">Due in {days}d</Badge>;
  return <Badge variant="muted">Valid</Badge>;
}

export function CriticalityBadge({ criticality }: { criticality: Criticality }) {
  const v = { critical: "critical", high: "warning", medium: "info", low: "muted" } as const;
  return (
    <Badge variant={v[criticality]} className="capitalize">
      {criticality}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const v = { P1: "critical", P2: "warning", P3: "info" } as const;
  return <Badge variant={v[priority]} className="font-mono">{priority}</Badge>;
}

export const WO_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  awaiting_verification: "Awaiting verification",
  closed: "Closed",
};

export function WOStatusBadge({ status }: { status: WorkOrderStatus }) {
  const v = { open: "critical", in_progress: "warning", awaiting_verification: "info", closed: "success" } as const;
  return <Badge variant={v[status]}>{WO_STATUS_LABEL[status]}</Badge>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h2 className="mt-1 text-base font-semibold">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function timeAgo(t: number, now: number) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export function formatDuration(ms: number) {
  const neg = ms < 0;
  const m = Math.round(Math.abs(ms) / 60000);
  let out: string;
  if (m < 60) out = `${m}m`;
  else if (m < 48 * 60) out = `${Math.floor(m / 60)}h ${m % 60}m`;
  else out = `${Math.round(m / 1440)}d`;
  return neg ? `-${out}` : out;
}

export function formatDateTime(t: number) {
  return new Date(t).toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kuala_Lumpur",
  });
}

export const KIND_DOT: Record<AuditKind, string> = {
  fault: "bg-critical",
  anomaly: "bg-critical",
  work_order: "bg-warning",
  inspection: "bg-info",
  verification: "bg-success",
  score: "bg-primary",
  insight: "bg-primary",
  system: "bg-muted-foreground",
};
