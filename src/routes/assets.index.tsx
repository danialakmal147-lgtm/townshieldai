import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, ScanLine, Search, ServerCog } from "lucide-react";
import { useMemo, useState } from "react";

import {
  ConditionBadge,
  CriticalityBadge,
  InspectionBadge,
  PageHeader,
} from "@/components/townshield/bits";
import { Input } from "@/components/ui/input";
import { inspectionState } from "@/lib/townshield/scoring";
import { useScores, useTown } from "@/lib/townshield/store";
import { ASSET_TYPE_LABEL, type CaptureMethod, type SiteId } from "@/lib/townshield/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assets/")({
  head: () => ({
    meta: [
      { title: "Asset Registry — TownShield AI" },
      { name: "description", content: "Every safety asset with location, owner, criticality, condition and inspection status." },
      { property: "og:title", content: "Asset Registry — TownShield AI" },
      { property: "og:description", content: "Digitised fire-safety assets across the Nilai Impian pilot sites." },
    ],
  }),
  component: AssetsPage,
});

const CAPTURE_ICON: Record<CaptureMethod, typeof Radio> = { iot: Radio, panel: ServerCog, qr: ScanLine };
const CAPTURE_LABEL: Record<CaptureMethod, string> = { iot: "IoT heartbeat", panel: "Panel status", qr: "QR inspection" };

type Filter = "all" | "issues" | "fault";

function AssetsPage() {
  const { state, now } = useTown();
  const { byAsset } = useScores();
  const [site, setSite] = useState<SiteId | "all">("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return state.assets
      .filter((a) => site === "all" || a.site === site)
      .filter((a) => {
        const s = byAsset.get(a.id)!;
        if (filter === "fault") return a.condition === "fault";
        if (filter === "issues") return s.score < 99.5;
        return true;
      })
      .filter((a) => {
        const t = q.trim().toLowerCase();
        return !t || `${a.id} ${a.name} ${a.location}`.toLowerCase().includes(t);
      })
      .sort((a, b) => byAsset.get(a.id)!.score - byAsset.get(b.id)!.score);
  }, [state.assets, site, filter, q, byAsset]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Asset layer"
        title="Asset registry"
        description="Know what exists, where it is, who owns it — and whether it is ready right now."
      />

      <div className="panel flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "A", "B", "C"] as const).map((s) => (
            <Chip key={s} active={site === s} onClick={() => setSite(s)}>
              {s === "all" ? "All sites" : `Site ${s} · ${state.sites.find((x) => x.id === s)!.name}`}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 md:ml-auto">
          {(["all", "issues", "fault"] as const).map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "issues" ? "Needs attention" : "Faults"}
            </Chip>
          ))}
        </div>
        <div className="relative md:w-56">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID or location" className="pl-8" />
        </div>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Asset</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Criticality</th>
              <th className="px-4 py-3 font-medium">Condition</th>
              <th className="px-4 py-3 font-medium">Inspection</th>
              <th className="px-4 py-3 font-medium">Data capture</th>
              <th className="px-4 py-3 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const s = byAsset.get(a.id)!;
              const insp = inspectionState(a, now);
              const Icon = CAPTURE_ICON[a.capture];
              return (
                <tr key={a.id} className={cn("border-b border-border/60 transition-colors hover:bg-surface-raised/50", s.exception && "bg-critical/8")}>
                  <td className="px-4 py-3">
                    <Link to="/assets/$assetId" params={{ assetId: a.id }} className="block">
                      <span className="font-mono text-xs text-primary">{a.id}</span>
                      <span className="block font-medium hover:underline">{a.name.split(" — ")[1] ?? a.name}</span>
                      <span className="block text-xs text-muted-foreground">{ASSET_TYPE_LABEL[a.type]}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <span className="block text-foreground">Site {a.site}</span>
                    {a.location}
                  </td>
                  <td className="px-4 py-3"><CriticalityBadge criticality={a.criticality} /></td>
                  <td className="px-4 py-3"><ConditionBadge condition={a.condition} /></td>
                  <td className="px-4 py-3"><InspectionBadge status={insp.status} days={insp.daysUntilDue} /></td>
                  <td className="px-4 py-3 text-xs">
                    <span className="flex items-center gap-1.5">
                      <Icon className="size-3.5 text-muted-foreground" />
                      {CAPTURE_LABEL[a.capture]}
                    </span>
                    {(a.connectivity === "stale" || a.connectivity === "offline") && (
                      <span className="text-warning capitalize">{a.connectivity}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn("font-mono text-base font-semibold tabular-nums", s.score >= 90 ? "text-success" : s.score >= 75 ? "text-warning" : "text-critical")}>
                      {Math.round(s.score)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No assets match these filters.</p>}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
