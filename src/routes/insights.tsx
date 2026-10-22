import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Lightbulb, Repeat, WifiOff, Wrench } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { PageHeader, Panel } from "@/components/townshield/bits";
import { TelemetryChart } from "@/components/townshield/telemetry-chart";
import { inspectionState, recurringFaults } from "@/lib/townshield/scoring";
import { useScores, useTown } from "@/lib/townshield/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "AI Insights & Pilot KPIs — TownShield AI" },
      { name: "description", content: "Explainable anomaly detection, recurring-fault analysis, maintenance recommendations and pilot success metrics." },
      { property: "og:title", content: "AI Insights & Pilot KPIs — TownShield AI" },
      { property: "og:description", content: "Where AI adds value: anomalies, recurring faults and risk-based priorities." },
    ],
  }),
  component: InsightsPage,
});

const HOUR = 3_600_000;
/** Illustrative pre-pilot baseline for acknowledgement time (hours). */
const BASELINE_ACK_HOURS = 6;

function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function InsightsPage() {
  const { state, now } = useTown();
  const { sites } = useScores();
  const [panel, setPanel] = useState<"EP-C01" | "EP-C02">("EP-C01");
  const assetById = new Map(state.assets.map((a) => [a.id, a]));

  const visible = state.assets.filter((a) => a.connectivity === "online" || a.connectivity === "manual").length;
  const connected = state.assets.filter((a) => a.capture !== "qr");
  const reliable = connected.filter((a) => a.connectivity === "online").length;
  const priorityClosed = state.workOrders.filter((w) => w.status === "closed" && w.priority !== "P3");
  const withinSla = priorityClosed.filter((w) => (w.closedAt ?? 0) <= w.dueAt).length;
  const ackHours = median(
    state.workOrders.filter((w) => w.acknowledgedAt).map((w) => (w.acknowledgedAt! - w.createdAt) / HOUR),
  );
  const recurring = recurringFaults(state.faults, now);

  const kpis = [
    { label: "Asset visibility", value: `${Math.round((visible / state.assets.length) * 100)}%`, target: "≥95%", ok: visible / state.assets.length >= 0.95, note: "Current status, owner and location" },
    { label: "Priority closure within SLA", value: priorityClosed.length ? `${Math.round((withinSla / priorityClosed.length) * 100)}%` : "—", target: "≥90%", ok: !priorityClosed.length || withinSla / priorityClosed.length >= 0.9, note: `${withinSla}/${priorityClosed.length} P1–P2 closed on time` },
    { label: "Median time to acknowledge", value: ackHours ? `${ackHours < 1 ? `${Math.round(ackHours * 60)}m` : `${ackHours.toFixed(1)}h`}` : "—", target: `−20% vs ${BASELINE_ACK_HOURS}h`, ok: !ackHours || ackHours <= BASELINE_ACK_HOURS * 0.8, note: "Detection → acknowledgement" },
    { label: "Data reliability", value: `${Math.round((reliable / connected.length) * 100)}%`, target: "≥95%", ok: reliable / connected.length >= 0.95, note: "Connected devices reporting live" },
  ];

  const recs: { icon: typeof Repeat; tone: string; title: string; body: string; assetId: string }[] = [];
  recurring.forEach((r) => {
    const a = assetById.get(r.assetId)!;
    recs.push({ icon: Repeat, tone: "text-warning", title: `Replace ${a.id} proactively`, body: `${r.count} failures in 180 days on a ${a.installedYear} unit. Replacement is likely cheaper than continued call-outs.`, assetId: a.id });
  });
  state.assets.forEach((a) => {
    const i = inspectionState(a, now);
    if (i.status === "due_soon") recs.push({ icon: CalendarClock, tone: "text-info", title: `${a.id} inspection due in ${i.daysUntilDue} days`, body: `Schedule with ${a.owner} to avoid a readiness drop.`, assetId: a.id });
    if (a.connectivity === "stale" || a.connectivity === "offline") recs.push({ icon: WifiOff, tone: "text-warning", title: `Check ${a.id} connectivity`, body: "Status data is not refreshing — readiness confidence reduced until verified on site.", assetId: a.id });
    if (a.condition === "degraded") recs.push({ icon: Wrench, tone: "text-warning", title: `${a.id} is degraded`, body: "Condition below standard but still functional — plan a repair before it becomes a fault.", assetId: a.id });
  });

  const siteData = state.sites.map((s) => ({ name: `Site ${s.id}`, score: sites[s.id].score, status: sites[s.id].status }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intelligence layer"
        title="AI insights"
        description="Deterministic rules for safety and audit; statistical models where pattern recognition adds value. TownShield does not claim to predict fires."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="panel p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={cn("mt-2 font-mono text-3xl font-semibold tabular-nums", k.ok ? "text-success" : "text-warning")}>{k.value}</p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">Target {k.target}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">{k.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          eyebrow="Anomaly detection"
          title="Electrical panel temperature"
          action={
            <div className="flex gap-1">
              {(["EP-C01", "EP-C02"] as const).map((p) => (
                <button key={p} onClick={() => setPanel(p)} className={cn("rounded-md border px-2 py-1 font-mono text-xs", panel === p ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground")}>
                  {p}
                </button>
              ))}
            </div>
          }
        >
          <TelemetryChart readings={state.telemetry[panel] ?? []} />
        </Panel>

        <Panel className="lg:col-span-2" eyebrow="Portfolio" title="Readiness by site">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={siteData} margin={{ top: 22, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} label={{ position: "top", fill: "var(--color-foreground)", fontSize: 12 }}>
                  {siteData.map((d) => (
                    <Cell
                      key={d.name}
                      fill={d.status === "ready" ? "var(--color-success)" : d.status === "attention" ? "var(--color-warning)" : "var(--color-critical)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel eyebrow="Recommendations" title="What to do next">
          {recs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recommendations right now.</p>
          ) : (
            <ul className="space-y-2">
              {recs.slice(0, 8).map((r, i) => (
                <li key={`${r.assetId}-${i}`}>
                  <Link to="/assets/$assetId" params={{ assetId: r.assetId }} className="flex gap-3 rounded-lg border border-border p-3 hover:border-primary/40">
                    <r.icon className={cn("mt-0.5 size-4 shrink-0", r.tone)} />
                    <div>
                      <p className="text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.body}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel eyebrow="Pattern analysis" title="Fault history by asset (180 days)">
          <FaultTable />
          <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" />
            Three or more faults in six months flags a recurring pattern. Predictive failure estimates switch on once enough history is collected.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function FaultTable() {
  const { state, now } = useTown();
  const counts = new Map<string, number>();
  state.faults
    .filter((f) => now - f.detectedAt <= 180 * 86_400_000)
    .forEach((f) => counts.set(f.assetId, (counts.get(f.assetId) ?? 0) + 1));
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!rows.length) return <p className="text-sm text-muted-foreground">No faults in the window.</p>;
  const max = rows[0]![1];
  return (
    <ul className="space-y-2">
      {rows.map(([id, c]) => (
        <li key={id} className="flex items-center gap-3 text-sm">
          <span className="w-16 font-mono text-xs text-primary">{id}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", c >= 3 ? "bg-warning" : "bg-primary/60")} style={{ width: `${(c / Math.max(3, max)) * 100}%` }} />
          </div>
          <span className={cn("w-6 text-right font-mono text-xs", c >= 3 && "text-warning")}>{c}</span>
        </li>
      ))}
    </ul>
  );
}
