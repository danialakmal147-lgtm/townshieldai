import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Repeat, ScanLine } from "lucide-react";

import {
  ConditionBadge,
  CriticalityBadge,
  InspectionBadge,
  Panel,
  PriorityBadge,
  ScoreRing,
  WOStatusBadge,
  formatDateTime,
  timeAgo,
} from "@/components/townshield/bits";
import { TelemetryChart } from "@/components/townshield/telemetry-chart";
import { Button } from "@/components/ui/button";
import {
  COMPONENT_LABEL,
  WEIGHTS,
  inspectionState,
  readinessStatus,
  recurringFaults,
  type Component,
} from "@/lib/townshield/scoring";
import { useScores, useTown } from "@/lib/townshield/store";
import { ASSET_TYPE_LABEL } from "@/lib/townshield/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assets/$assetId")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.assetId} — Asset Readiness — TownShield AI` },
      { name: "description", content: `Readiness breakdown, fault history and work orders for safety asset ${params.assetId}.` },
      { property: "og:title", content: `${params.assetId} — TownShield AI` },
      { property: "og:description", content: `Explainable readiness score and maintenance history for ${params.assetId}.` },
    ],
  }),
  component: AssetDetail,
});

function QrTag({ id }: { id: string }) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const cells = Array.from({ length: 121 }, (_, i) => {
    const x = i % 11;
    const y = Math.floor(i / 11);
    const finder = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
    if (finder) return !(x === 1 && y === 1) && !(x === 9 && y === 1) && !(x === 1 && y === 9);
    h = (h * 1103515245 + 12345) >>> 0;
    return (h >> 16) % 2 === 0;
  });
  return (
    <div className="grid w-28 grid-cols-11 gap-px rounded-md bg-foreground p-2">
      {cells.map((on, i) => (
        <span key={i} className={cn("aspect-square", on ? "bg-background" : "bg-foreground")} />
      ))}
    </div>
  );
}

function AssetDetail() {
  const { assetId } = Route.useParams();
  const { state, now } = useTown();
  const { byAsset } = useScores();
  const asset = state.assets.find((a) => a.id === assetId);

  if (!asset) {
    return (
      <div className="panel p-10 text-center">
        <p className="text-lg font-semibold">Asset {assetId} not found</p>
        <Button asChild variant="secondary" className="mt-4">
          <Link to="/assets">Back to registry</Link>
        </Button>
      </div>
    );
  }

  const s = byAsset.get(asset.id)!;
  const insp = inspectionState(asset, now);
  const site = state.sites.find((x) => x.id === asset.site)!;
  const faults = state.faults.filter((f) => f.assetId === asset.id).sort((a, b) => b.detectedAt - a.detectedAt);
  const wos = state.workOrders.filter((w) => w.assetId === asset.id).sort((a, b) => b.createdAt - a.createdAt);
  const recurring = recurringFaults(state.faults, now).find((r) => r.assetId === asset.id);
  const readings = state.telemetry[asset.id];
  const score = Math.round(s.score);

  return (
    <div className="space-y-6">
      <Link to="/assets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Asset registry
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">{ASSET_TYPE_LABEL[asset.type]} · Site {site.id} {site.name}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
            <span className="font-mono text-primary">{asset.id}</span> {asset.name.split(" — ")[1] ?? asset.name}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <CriticalityBadge criticality={asset.criticality} />
            <ConditionBadge condition={asset.condition} />
            <InspectionBadge status={insp.status} days={insp.daysUntilDue} />
          </div>
        </div>
        <Button asChild>
          <Link to="/inspect" search={{ asset: asset.id }}>
            <ScanLine /> Scan & inspect
          </Link>
        </Button>
      </div>

      {s.exception && (
        <div className="panel-critical flex items-start gap-3 p-4">
          <AlertTriangle className="mt-0.5 size-5 text-critical" />
          <div>
            <p className="font-medium text-critical">Critical life-safety exception</p>
            <p className="text-sm text-muted-foreground">{s.reasons[0]}. Shown in red regardless of the overall score.</p>
          </div>
        </div>
      )}

      {recurring && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <Repeat className="mt-0.5 size-5 text-warning" />
          <div>
            <p className="font-medium text-warning">Recurring failure pattern</p>
            <p className="text-sm text-muted-foreground">
              {recurring.count} faults in the last 180 days (installed {asset.installedYear}). TownShield recommends proactive replacement instead of another repair.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel eyebrow="Explainable score" title="Readiness breakdown" className="lg:col-span-2">
          <div className="flex flex-col gap-6 sm:flex-row">
            <ScoreRing score={score} status={readinessStatus(score, s.exception ? 1 : 0)} size={140} label="Asset" />
            <div className="flex-1 space-y-3">
              {(Object.keys(WEIGHTS) as Component[]).map((k) => (
                <div key={k}>
                  <div className="flex justify-between text-xs">
                    <span>{COMPONENT_LABEL[k]} <span className="text-muted-foreground">· {WEIGHTS[k]}%</span></span>
                    <span className={cn("font-mono", s.deductions[k] > 0.05 ? "text-warning" : "text-muted-foreground")}>
                      {(s.factors[k] * WEIGHTS[k]).toFixed(1)} / {WEIGHTS[k]}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all", s.factors[k] >= 0.99 ? "bg-success" : s.factors[k] >= 0.5 ? "bg-warning" : "bg-critical")}
                      style={{ width: `${s.factors[k] * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {s.reasons.length > 0 && (
            <ul className="mt-5 space-y-1 border-t border-border pt-4 text-sm">
              {s.reasons.map((r) => (
                <li key={r} className="flex gap-2"><span className="text-warning">▸</span>{r}</li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel eyebrow="Asset record" title="Details">
          <div className="flex gap-4">
            <QrTag id={asset.id} />
            <div className="text-xs text-muted-foreground">
              <p className="font-mono text-foreground">TS-{asset.id}</p>
              <p className="mt-1">QR/NFC tag mounted on asset. Technicians scan to inspect and upload evidence.</p>
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            {[
              ["Location", asset.location],
              ["Owner", asset.owner],
              ["Data capture", asset.capture === "iot" ? "IoT heartbeat" : asset.capture === "panel" ? "Read-only panel status" : "QR inspection"],
              ["Connectivity", asset.connectivity],
              ["Last inspection", `${formatDateTime(asset.lastInspection)} (${timeAgo(asset.lastInspection, now)})`],
              ["Interval", `Every ${asset.inspectionIntervalDays} days`],
              ["Installed", `${asset.installedYear}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      {readings && (
        <Panel eyebrow="Condition data" title="Panel temperature — last 24 h">
          <TelemetryChart readings={readings} />
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel eyebrow="History" title="Fault history">
          {faults.length === 0 ? (
            <p className="text-sm text-muted-foreground">No faults recorded.</p>
          ) : (
            <ul className="space-y-3">
              {faults.map((f) => (
                <li key={f.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-xs font-semibold uppercase", f.resolvedAt ? "text-muted-foreground" : "text-critical")}>
                      {f.severity} · {f.resolvedAt ? "resolved" : "open"}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(f.detectedAt)}</span>
                  </div>
                  <p className="mt-1 text-sm">{f.description}</p>
                  <p className="text-xs text-muted-foreground">Source: {f.source}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel eyebrow="Maintenance" title="Work orders">
          {wos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No work orders.</p>
          ) : (
            <ul className="space-y-3">
              {wos.map((w) => (
                <li key={w.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs">{w.id}</span>
                    <PriorityBadge priority={w.priority} />
                    <WOStatusBadge status={w.status} />
                  </div>
                  <p className="mt-1 text-sm">{w.title}</p>
                  {w.evidence && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {w.evidence.technician}: {w.evidence.notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
