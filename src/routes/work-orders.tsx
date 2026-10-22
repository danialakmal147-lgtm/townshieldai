import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, CheckCheck, Clock, RotateCcw, ScanLine, UserCheck } from "lucide-react";
import { toast } from "sonner";

import {
  PageHeader,
  PriorityBadge,
  WO_STATUS_LABEL,
  formatDateTime,
  formatDuration,
} from "@/components/townshield/bits";
import { Button } from "@/components/ui/button";
import { useTown } from "@/lib/townshield/store";
import type { WorkOrder, WorkOrderStatus } from "@/lib/townshield/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/work-orders")({
  head: () => ({
    meta: [
      { title: "Work Orders — TownShield AI" },
      { name: "description", content: "Risk-prioritised maintenance tasks with SLA tracking, field evidence and supervisor verification." },
      { property: "og:title", content: "Work Orders — TownShield AI" },
      { property: "og:description", content: "Detect, prioritise, assign, act, verify — the closed maintenance loop." },
    ],
  }),
  component: WorkOrdersPage,
});

const COLUMNS: WorkOrderStatus[] = ["open", "in_progress", "awaiting_verification", "closed"];
const SUPERVISOR = "Supervisor Aina";
const PRIORITY_RANK = { P1: 0, P2: 1, P3: 2 };

function WorkOrdersPage() {
  const { state, now, dispatch } = useTown();
  const open = state.workOrders.filter((w) => w.status !== "closed");
  const overdue = open.filter((w) => w.dueAt < now).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Work orders"
        description="Every fault becomes a prioritised, owned task with an SLA. Closure requires field evidence and supervisor verification."
        actions={
          <div className="flex gap-2 font-mono text-xs">
            <span className="rounded-lg border border-border px-3 py-2">{open.length} open</span>
            <span className={cn("rounded-lg border px-3 py-2", overdue ? "border-critical/50 text-critical" : "border-border")}>
              {overdue} past SLA
            </span>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = state.workOrders
            .filter((w) => w.status === col)
            .sort((a, b) =>
              col === "closed"
                ? (b.closedAt ?? 0) - (a.closedAt ?? 0)
                : PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.dueAt - b.dueAt,
            );
          return (
            <section key={col} className="rounded-xl border border-border bg-surface/50 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold">{WO_STATUS_LABEL[col]}</h2>
                <span className="font-mono text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-3">
                {items.map((w) => (
                  <WOCard
                    key={w.id}
                    wo={w}
                    now={now}
                    assetName={state.assets.find((a) => a.id === w.assetId)?.name ?? w.assetId}
                    onAck={() => {
                      dispatch({ type: "acknowledge", woId: w.id, actor: SUPERVISOR, at: Date.now() });
                      toast.success(`${w.id} acknowledged`);
                    }}
                    onClose={() => {
                      dispatch({ type: "verify_close", woId: w.id, actor: SUPERVISOR, at: Date.now() });
                      toast.success(`${w.id} verified and closed`, { description: "Readiness score and audit trail updated." });
                    }}
                    onRecheck={() => {
                      dispatch({ type: "request_recheck", woId: w.id, actor: SUPERVISOR, at: Date.now() });
                      toast.message(`Re-check requested for ${w.id}`);
                    }}
                  />
                ))}
                {items.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted-foreground">Nothing here.</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function WOCard({
  wo,
  now,
  assetName,
  onAck,
  onClose,
  onRecheck,
}: {
  wo: WorkOrder;
  now: number;
  assetName: string;
  onAck: () => void;
  onClose: () => void;
  onRecheck: () => void;
}) {
  const remaining = wo.dueAt - now;
  const late = wo.status !== "closed" && remaining < 0;
  return (
    <article className={cn("panel animate-rise p-3", wo.priority === "P1" && wo.status !== "closed" && "border-critical/50")}>
      <div className="flex items-center gap-2">
        <PriorityBadge priority={wo.priority} />
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">{wo.id}</span>
        {wo.status !== "closed" && (
          <span className={cn("ml-auto flex items-center gap-1 font-mono text-[11px]", late ? "text-critical" : "text-muted-foreground")}>
            <Clock className="size-3" />
            {late ? `${formatDuration(-remaining)} late` : formatDuration(remaining)}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm font-medium leading-snug">{wo.title}</p>
      <Link to="/assets/$assetId" params={{ assetId: wo.assetId }} className="mt-1 block text-xs text-muted-foreground hover:text-foreground">
        <span className="font-mono text-primary">{wo.assetId}</span> · {assetName.split(" — ")[1] ?? assetName}
      </Link>
      <p className="mt-1 text-[11px] text-muted-foreground">→ {wo.assignee}</p>

      {wo.evidence && (
        <div className="mt-3 rounded-lg border border-border bg-background/40 p-2 text-xs">
          <div className="flex gap-2">
            {wo.evidence.photo ? (
              <img src={wo.evidence.photo} alt="Field evidence" className="size-14 shrink-0 rounded object-cover" />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded bg-muted">
                <Camera className="size-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <p className={cn("font-semibold", wo.evidence.result === "pass" ? "text-success" : "text-critical")}>
                {wo.evidence.result === "pass" ? "Repair passed test" : "Still failing"}
              </p>
              <p className="text-muted-foreground">{wo.evidence.notes}</p>
              {wo.evidence.partReplaced && <p className="text-muted-foreground">Part: {wo.evidence.partReplaced}</p>}
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{wo.evidence.technician} · {formatDateTime(wo.evidence.submittedAt)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {wo.status === "open" && (
          <>
            <Button size="sm" onClick={onAck}><UserCheck /> Acknowledge</Button>
            <Button size="sm" variant="secondary" asChild>
              <Link to="/inspect" search={{ asset: wo.assetId }}><ScanLine /> Inspect</Link>
            </Button>
          </>
        )}
        {wo.status === "in_progress" && (
          <Button size="sm" variant="secondary" asChild>
            <Link to="/inspect" search={{ asset: wo.assetId }}><ScanLine /> Open in field app</Link>
          </Button>
        )}
        {wo.status === "awaiting_verification" && (
          <>
            <Button size="sm" onClick={onClose}><CheckCheck /> Verify & close</Button>
            <Button size="sm" variant="ghost" onClick={onRecheck}><RotateCcw /> Re-check</Button>
          </>
        )}
        {wo.status === "closed" && wo.closedAt && (
          <p className="text-[11px] text-success">
            Closed by {wo.closedBy} · {formatDateTime(wo.closedAt)}
          </p>
        )}
      </div>
    </article>
  );
}
