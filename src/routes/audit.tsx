import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { KIND_DOT, PageHeader, formatDateTime } from "@/components/townshield/bits";
import { useTown } from "@/lib/townshield/store";
import type { AuditKind } from "@/lib/townshield/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail — TownShield AI" },
      { name: "description", content: "Timestamped record of faults, score changes, work orders, inspections and verifications." },
      { property: "og:title", content: "Audit Trail — TownShield AI" },
      { property: "og:description", content: "Every alert and score change, with its reason and actor." },
    ],
  }),
  component: AuditPage,
});

const KIND_LABEL: Record<AuditKind, string> = {
  fault: "Fault",
  anomaly: "Anomaly",
  work_order: "Work order",
  inspection: "Inspection",
  verification: "Verification",
  score: "Score change",
  insight: "AI insight",
  system: "System",
};

function AuditPage() {
  const { state } = useTown();
  const [kind, setKind] = useState<AuditKind | "all">("all");
  const events = state.audit.filter((e) => kind === "all" || e.kind === kind);
  const kinds = Object.keys(KIND_LABEL) as AuditKind[];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Audit trail"
        description="Retained log of detections, acknowledgements, evidence and verifications for accountability and reporting."
      />
      <div className="flex flex-wrap gap-1.5">
        {(["all", ...kinds] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
              kind === k ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {k !== "all" && <span className={cn("size-1.5 rounded-full", KIND_DOT[k])} />}
            {k === "all" ? "All events" : KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Time (MYT)</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">Actor</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-border/60 align-top">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">{formatDateTime(e.at)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="flex items-center gap-1.5 text-xs">
                    <span className={cn("size-2 rounded-full", KIND_DOT[e.kind])} />
                    {KIND_LABEL[e.kind]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {e.message}
                  {e.assetId && (
                    <Link to="/assets/$assetId" params={{ assetId: e.assetId }} className="ml-2 font-mono text-xs text-primary hover:underline">
                      {e.assetId} →
                    </Link>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{e.actor}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No events of this type.</p>}
      </div>
    </div>
  );
}
