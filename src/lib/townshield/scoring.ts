import type {
  Asset,
  Connectivity,
  Criticality,
  Fault,
  Priority,
  Severity,
} from "./types";

/** Fire Safety Readiness Score component weights (sum = 100). */
export const WEIGHTS = {
  criticality: 30,
  condition: 30,
  inspection: 15,
  fault: 15,
  confidence: 10,
} as const;

export type Component = keyof typeof WEIGHTS;

export const COMPONENT_LABEL: Record<Component, string> = {
  criticality: "Asset criticality",
  condition: "Condition / status",
  inspection: "Inspection validity",
  fault: "Fault severity & duration",
  confidence: "Data confidence",
};

/** How strongly an unhealthy asset drags down the score, and its weight in group averages. */
export const CRITICALITY_WEIGHT: Record<Criticality, number> = {
  critical: 1,
  high: 0.75,
  medium: 0.5,
  low: 0.25,
};

export const SLA_HOURS: Record<Priority, number> = { P1: 4, P2: 24, P3: 72 };

const DAY = 86_400_000;
const HOUR = 3_600_000;

export type InspectionStatus = "valid" | "due_soon" | "grace" | "overdue";

export function inspectionState(asset: Asset, now: number) {
  const daysSince = Math.max(0, (now - asset.lastInspection) / DAY);
  const interval = asset.inspectionIntervalDays;
  let status: InspectionStatus;
  if (daysSince <= interval * 0.85) status = "valid";
  else if (daysSince <= interval) status = "due_soon";
  else if (daysSince <= interval * 1.25) status = "grace";
  else status = "overdue";
  return {
    status,
    daysSince: Math.floor(daysSince),
    daysUntilDue: Math.ceil(interval - daysSince),
  };
}

const INSPECTION_FACTOR: Record<InspectionStatus, number> = {
  valid: 1,
  due_soon: 1,
  grace: 0.5,
  overdue: 0,
};

const CONDITION_FACTOR = { ok: 1, degraded: 0.5, fault: 0 } as const;

const CONFIDENCE_FACTOR: Record<Connectivity, number> = {
  online: 1,
  manual: 1,
  stale: 0.5,
  offline: 0,
};

const SEVERITY_BASE: Record<Severity, number> = { critical: 0, high: 0.3, low: 0.7 };

export function faultFactor(fault: Fault | undefined, now: number) {
  if (!fault || fault.resolvedAt) return 1;
  const days = Math.floor(Math.max(0, now - fault.detectedAt) / (24 * HOUR));
  return Math.max(0, SEVERITY_BASE[fault.severity] - days * 0.1);
}

/** A critical unresolved life-safety fault is always a red exception, whatever the score. */
export function isCriticalException(asset: Asset, fault: Fault | undefined) {
  if (!fault || fault.resolvedAt) return false;
  return fault.severity === "critical" || asset.criticality === "critical";
}

export interface AssetScore {
  assetId: string;
  score: number;
  factors: Record<Component, number>;
  deductions: Record<Component, number>;
  reasons: string[];
  exception: boolean;
}

export function scoreAsset(asset: Asset, openFault: Fault | undefined, now: number): AssetScore {
  const insp = inspectionState(asset, now);
  const condition = CONDITION_FACTOR[asset.condition];
  const inspection = INSPECTION_FACTOR[insp.status];
  const fault = faultFactor(openFault, now);
  const confidence = CONFIDENCE_FACTOR[asset.connectivity];
  const health =
    (condition * WEIGHTS.condition +
      inspection * WEIGHTS.inspection +
      fault * WEIGHTS.fault +
      confidence * WEIGHTS.confidence) /
    (100 - WEIGHTS.criticality);
  const criticality = 1 - (1 - health) * CRITICALITY_WEIGHT[asset.criticality];

  const factors: Record<Component, number> = {
    criticality,
    condition,
    inspection,
    fault,
    confidence,
  };
  const deductions = {} as Record<Component, number>;
  let score = 0;
  (Object.keys(WEIGHTS) as Component[]).forEach((k) => {
    score += factors[k] * WEIGHTS[k];
    deductions[k] = (1 - factors[k]) * WEIGHTS[k];
  });

  const reasons: string[] = [];
  if (openFault && !openFault.resolvedAt) reasons.push(`Unresolved ${openFault.severity} fault: ${openFault.description}`);
  else if (asset.condition === "fault") reasons.push("Device reporting fault");
  if (asset.condition === "degraded") reasons.push("Degraded condition");
  if (insp.status === "grace" || insp.status === "overdue")
    reasons.push(`Inspection overdue by ${insp.daysSince - asset.inspectionIntervalDays} days`);
  if (asset.connectivity === "stale") reasons.push("Status data is stale");
  if (asset.connectivity === "offline") reasons.push("Device offline — no heartbeat");

  return {
    assetId: asset.id,
    score,
    factors,
    deductions,
    reasons,
    exception: isCriticalException(asset, openFault),
  };
}

export type ReadinessStatus = "critical" | "at_risk" | "attention" | "ready";

export function readinessStatus(score: number, exceptionCount: number): ReadinessStatus {
  if (exceptionCount > 0) return "critical";
  if (score >= 90) return "ready";
  if (score >= 75) return "attention";
  return "at_risk";
}

export interface GroupScore {
  score: number;
  status: ReadinessStatus;
  assetScores: AssetScore[];
  exceptions: AssetScore[];
  /** Assets that cost the group points, largest first, with their points impact on the group score. */
  drivers: { assetId: string; points: number; reasons: string[] }[];
}

export function scoreGroup(
  assets: Asset[],
  faultsById: Map<string, Fault>,
  now: number,
): GroupScore {
  const assetScores = assets.map((a) =>
    scoreAsset(a, a.openFaultId ? faultsById.get(a.openFaultId) : undefined, now),
  );
  const totalW = assets.reduce((s, a) => s + CRITICALITY_WEIGHT[a.criticality], 0) || 1;
  let weighted = 0;
  const drivers: GroupScore["drivers"] = [];
  assetScores.forEach((s, i) => {
    const w = CRITICALITY_WEIGHT[assets[i]!.criticality];
    weighted += s.score * w;
    const points = ((100 - s.score) * w) / totalW;
    if (points > 0.05) drivers.push({ assetId: s.assetId, points, reasons: s.reasons });
  });
  drivers.sort((a, b) => b.points - a.points);
  const score = assets.length ? Math.round(weighted / totalW) : 100;
  const exceptions = assetScores.filter((s) => s.exception);
  return {
    score,
    status: readinessStatus(score, exceptions.length),
    assetScores,
    exceptions,
    drivers,
  };
}

export function workOrderPriority(severity: Severity, criticality: Criticality): Priority {
  if (severity === "critical" || criticality === "critical") return "P1";
  if (severity === "high" || criticality === "high") return "P2";
  return "P3";
}

/** Assets with `threshold` or more faults detected inside the rolling window. */
export function recurringFaults(
  faults: Fault[],
  now: number,
  windowDays = 180,
  threshold = 3,
): { assetId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const f of faults) {
    if (now - f.detectedAt <= windowDays * DAY) {
      counts.set(f.assetId, (counts.get(f.assetId) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= threshold)
    .map(([assetId, count]) => ({ assetId, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Statistical anomaly check with a persistence rule: the last `persistence`
 * readings must all sit at least `z` standard deviations from the baseline
 * window that precedes them. One spike alone never raises an alert.
 */
export function detectAnomaly(
  series: number[],
  opts: { baseline?: number; z?: number; persistence?: number } = {},
) {
  const baseline = opts.baseline ?? 24;
  const zLimit = opts.z ?? 3;
  const persistence = opts.persistence ?? 3;
  const recent = series.slice(-persistence);
  const base = series.slice(-(persistence + baseline), -persistence);
  if (base.length < 5 || recent.length < persistence) {
    return { anomalous: false, mean: 0, std: 0, upper: 0, zScores: [] as number[] };
  }
  const mean = base.reduce((s, v) => s + v, 0) / base.length;
  const std = Math.max(
    0.25,
    Math.sqrt(base.reduce((s, v) => s + (v - mean) ** 2, 0) / base.length),
  );
  const zScores = recent.map((v) => (v - mean) / std);
  return {
    anomalous: zScores.every((z) => Math.abs(z) >= zLimit),
    mean,
    std,
    upper: mean + zLimit * std,
    zScores,
  };
}
