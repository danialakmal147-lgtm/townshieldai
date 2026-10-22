import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  BatteryWarning,
  CheckCircle2,
  Flame,
  Thermometer,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import {
  Panel,
  PageHeader,
  ReadinessBadge,
  ScoreRing,
  timeAgo,
} from "@/components/townshield/bits";
import { Button } from "@/components/ui/button";
import { inspectionState } from "@/lib/townshield/scoring";
import { useScores, useTown } from "@/lib/townshield/store";
import type { AuditKind } from "@/lib/townshield/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Township Readiness Overview — TownShield AI" },
      {
        name: "description",
        content: "Live fire-safety readiness score, critical exceptions and maintenance priorities across Nilai Impian pilot sites.",
      },
      { property: "og:title", content: "Township Readiness Overview — TownShield AI" },
      {
        property: "og:description",
        content: "One operational view of safety asset condition, faults, inspections and priorities.",
      },
    ],
  }),
  component: Overview,
});

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

function Overview() {
  const { state, now, dispatch } = useTown();
  const { township, sites } = useScores();
  const assetById = new Map(state.assets.map((a) => [a.id, a]));

  const openWOs = state.workOrders.filter((w) => w.status !== "closed");
  const overdueInspections = state.assets.filter((a) => {
    const s = inspectionState(a, now).status;
    return s === "grace" || s === "overdue";
  }).length;
  const visible = state.assets.filter((a) => a.connectivity !== "offline").length;

  const scenarios = [
    {
      key: "light",
      icon: BatteryWarning,
      label: "Emergency light failure",
      hint: "EL-A03 · Community Hall",
      run: () =>
        dispatch({
          type: "raise_fault",
          assetId: "EL-A03",
          severity: "high",
          description: "Lamp failed self-test — no output on mains-fail test",
          source: "Device heartbeat",
          at: Date.now(),
        }),
    },
    {
      key: "panel",
      icon: Flame,
      label: "Fire alarm panel fault",
      hint: "FAP-B01 · Management Office",
      run: () =>
        dispatch({
          type: "raise_fault",
          assetId: "FAP-B01",
          severity: "critical",
          description: "Zone 3 detection loop open-circuit",
          source: "Panel status (read-only)",
          at: Date.now(),
        }),
    },
    {
      key: "temp",
      icon: Thermometer,
      label: "Panel temperature anomaly",
      hint: "EP-C01 · Substation",
      run: () => dispatch({ type: "simulate_anomaly", assetId: "EP-C01", at: Date.now() }),
    },
  ];

  const scenarioDisabled = (key: string) => {
    const id = key === "light" ? "EL-A03" : key === "panel" ? "FAP-B01" : "EP-C01";
    return !!assetById.get(id)?.openFaultId;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Nilai Impian living lab · Township of Tomorrow"
        title="Township safety readiness"
        description="From knowing that an asset exists to knowing that it is ready. Every score change shows its reason."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <ScoreRing score={township.score} status={township.status} size={184} label="Township" />
            <div className="w-full flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <ReadinessBadge status={township.status} />
                <span className="text-xs text-muted-foreground">
                  Fire Safety Readiness Score · operational indicator, not legal certification
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Assets monitored" value={`${state.assets.length}`} sub={`${Math.round((visible / state.assets.length) * 100)}% visible`} />
                <Stat label="Open work orders" value={`${openWOs.length}`} sub={`${openWOs.filter((w) => w.priority === "P1").length} P1`} />
                <Stat label="Critical exceptions" value={`${township.exceptions.length}`} tone={township.exceptions.length ? "critical" : "ok"} />
                <Stat label="Overdue inspections" value={`${overdueInspections}`} tone={overdueInspections ? "warn" : "ok"} />
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          className={cn("lg:col-span-2", township.exceptions.length > 0 && "panel-critical")}
          eyebrow="Life-safety exceptions"
          title={township.exceptions.length ? `${township.exceptions.length} critical, unresolved` : "No critical exceptions"}
        >
          {township.exceptions.length === 0 ? (
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-5 text-success" />
              <p>All critical life-safety assets are free of unresolved faults. A high score will never hide a critical failure — they always appear here in red.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {township.exceptions.map((e) => {
                const a = assetById.get(e.assetId)!;
                return (
                  <li key={e.assetId} className="animate-rise">
                    <Link
                      to="/assets/$assetId"
                      params={{ assetId: a.id }}
                      className="flex items-start gap-3 rounded-lg border border-critical/40 bg-critical/10 p-3 transition-colors hover:bg-critical/15"
                    >
                      <AlertOctagon className="mt-0.5 size-5 shrink-0 text-critical" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          <span className="font-mono text-critical">{a.id}</span> · {a.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{e.reasons[0]}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {state.sites.map((site) => {
          const g = sites[site.id];
          const top = g.drivers[0];
          return (
            <Link key={site.id} to="/assets" className="panel group block p-5 transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Site {site.id} · {site.kind}</p>
                  <h3 className="mt-1 font-semibold">{site.name}</h3>
                </div>
                <ScoreRing score={g.score} status={g.status} size={72} stroke={7} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <ReadinessBadge status={g.status} />
                <span className="text-xs text-muted-foreground">
                  {state.assets.filter((a) => a.site === site.id).length} assets
                </span>
              </div>
              <p className="mt-3 min-h-10 text-xs text-muted-foreground">
                {top ? (
                  <>
                    <span className="font-mono text-foreground">−{top.points.toFixed(1)}</span> {top.assetId}: {top.reasons[0] ?? "reduced readiness"}
                  </>
                ) : (
                  "All assets healthy, inspected and reporting."
                )}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-2" eyebrow="Live demonstration" title="Simulate a field event">
          <p className="mb-4 text-xs text-muted-foreground">
            Inject a read-only event to watch TownShield detect, explain, prioritise and assign — then close the loop from the field inspection screen.
          </p>
          <div className="space-y-2">
            {scenarios.map((s) => (
              <button
                key={s.key}
                disabled={scenarioDisabled(s.key)}
                onClick={() => {
                  s.run();
                  toast.warning(`${s.label} detected`, { description: "Score updated and work order created." });
                }}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface-raised/50 p-3 text-left transition-colors hover:border-primary/50 hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
              >
                <s.icon className="size-5 text-warning" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{s.hint}</p>
                </div>
                <Zap className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link to="/work-orders">Work orders <ArrowRight /></Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/inspect" search={{}}>Field inspection <ArrowRight /></Link>
            </Button>
          </div>
        </Panel>

        <Panel className="lg:col-span-3" eyebrow="Explainability" title="Why the township is not at 100">
          {township.drivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is reducing readiness right now.</p>
          ) : (
            <ul className="space-y-2.5">
              {township.drivers.slice(0, 6).map((d) => {
                const a = assetById.get(d.assetId)!;
                const max = township.drivers[0].points;
                return (
                  <li key={d.assetId}>
                    <Link to="/assets/$assetId" params={{ assetId: a.id }} className="group block">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate">
                          <span className="font-mono text-primary">{a.id}</span>{" "}
                          <span className="text-muted-foreground group-hover:text-foreground">{d.reasons[0] ?? a.name}</span>
                        </span>
                        <span className="shrink-0 font-mono text-xs text-warning">−{d.points.toFixed(1)} pts</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-warning/80" style={{ width: `${(d.points / max) * 100}%` }} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        eyebrow="Activity"
        title="Live event stream"
        action={
          <Button asChild size="sm" variant="ghost">
            <Link to="/audit">Full audit trail <ArrowRight /></Link>
          </Button>
        }
      >
        <ul className="divide-y divide-border">
          {state.audit.slice(0, 8).map((e) => (
            <li key={e.id} className="flex items-start gap-3 py-2.5 animate-rise">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", KIND_DOT[e.kind])} />
              <p className="flex-1 text-sm">{e.message}</p>
              <span className="shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                {timeAgo(e.at, now)}
                <br />
                <span className="hidden sm:inline">{e.actor}</span>
              </span>
            </li>
          ))}
        </ul>
        {state.audit.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Activity className="size-4" /> No events yet.</p>
        )}
      </Panel>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "critical" }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised/40 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-2xl font-semibold tabular-nums",
          tone === "critical" && "text-critical",
          tone === "warn" && "text-warning",
        )}
      >
        {value}
      </p>
      {sub && <p className="font-mono text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
