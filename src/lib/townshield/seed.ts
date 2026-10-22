import type { Asset, AuditEvent, Fault, Reading, Site, TownState, WorkOrder } from "./types";

const DAY = 86_400_000;
const HOUR = 3_600_000;

export const SITES: Site[] = [
  {
    id: "A",
    name: "Community Hall",
    kind: "Residential / community",
    description: "Emergency lights, exit signs and selected extinguishers.",
  },
  {
    id: "B",
    name: "Township Management Office",
    kind: "Commercial / management",
    description: "Fire alarm panel status, detectors and maintenance workflow.",
  },
  {
    id: "C",
    name: "Industrial Park Substation",
    kind: "Industrial / electrical",
    description: "Panel temperature & current, fire pump and hydrant readiness.",
  },
];

const FACILITIES = "In-house Facilities Team";
const FIRE_CONTRACTOR = "FireSafe Contractor";
const ELEC_CONTRACTOR = "Electrical Contractor";

type AssetSeed = Omit<Asset, "lastInspection" | "condition" | "connectivity"> & {
  inspectedDaysAgo: number;
  condition?: Asset["condition"];
  connectivity?: Asset["connectivity"];
};

const ASSETS: AssetSeed[] = [
  // Site A — community
  { id: "EL-A01", name: "Emergency light — Main entrance", type: "emergency_light", site: "A", location: "Ground floor, lobby", criticality: "high", capture: "iot", owner: FACILITIES, inspectionIntervalDays: 30, inspectedDaysAgo: 8, installedYear: 2019 },
  { id: "EL-A02", name: "Emergency light — Hall east", type: "emergency_light", site: "A", location: "Main hall, east wall", criticality: "high", capture: "iot", owner: FACILITIES, inspectionIntervalDays: 30, inspectedDaysAgo: 12, installedYear: 2017, condition: "degraded" },
  { id: "EL-A03", name: "Emergency light — Stairwell 2", type: "emergency_light", site: "A", location: "Stairwell 2, level 1", criticality: "high", capture: "iot", owner: FACILITIES, inspectionIntervalDays: 30, inspectedDaysAgo: 6, installedYear: 2016 },
  { id: "EL-A04", name: "Emergency light — Kitchen", type: "emergency_light", site: "A", location: "Kitchen corridor", criticality: "high", capture: "iot", owner: FACILITIES, inspectionIntervalDays: 30, inspectedDaysAgo: 10, installedYear: 2020 },
  { id: "EX-A01", name: "Exit sign — North exit", type: "exit_sign", site: "A", location: "North fire exit", criticality: "high", capture: "iot", owner: FACILITIES, inspectionIntervalDays: 30, inspectedDaysAgo: 8, installedYear: 2019 },
  { id: "EX-A02", name: "Exit sign — South exit", type: "exit_sign", site: "A", location: "South fire exit", criticality: "high", capture: "iot", owner: FACILITIES, inspectionIntervalDays: 30, inspectedDaysAgo: 9, installedYear: 2019, connectivity: "stale" },
  { id: "FE-A01", name: "Extinguisher — Lobby", type: "extinguisher", site: "A", location: "Lobby, by reception", criticality: "medium", capture: "qr", owner: FIRE_CONTRACTOR, inspectionIntervalDays: 30, inspectedDaysAgo: 14, installedYear: 2022 },
  { id: "FE-A02", name: "Extinguisher — Kitchen", type: "extinguisher", site: "A", location: "Kitchen, by exit door", criticality: "medium", capture: "qr", owner: FIRE_CONTRACTOR, inspectionIntervalDays: 30, inspectedDaysAgo: 34, installedYear: 2021 },
  { id: "FE-A03", name: "Extinguisher — Hall stage", type: "extinguisher", site: "A", location: "Main hall, stage left", criticality: "medium", capture: "qr", owner: FIRE_CONTRACTOR, inspectionIntervalDays: 30, inspectedDaysAgo: 5, installedYear: 2022 },
  // Site B — commercial / management
  { id: "FAP-B01", name: "Fire alarm panel — Main", type: "fire_alarm_panel", site: "B", location: "Ground floor, security room", criticality: "critical", capture: "panel", owner: FIRE_CONTRACTOR, inspectionIntervalDays: 30, inspectedDaysAgo: 11, installedYear: 2018 },
  { id: "SD-B01", name: "Smoke detector — Lobby", type: "smoke_detector", site: "B", location: "Lobby ceiling", criticality: "high", capture: "panel", owner: FIRE_CONTRACTOR, inspectionIntervalDays: 90, inspectedDaysAgo: 40, installedYear: 2018 },
  { id: "SD-B02", name: "Smoke detector — Open office", type: "smoke_detector", site: "B", location: "Level 1, open office", criticality: "high", capture: "panel", owner: FIRE_CONTRACTOR, inspectionIntervalDays: 90, inspectedDaysAgo: 40, installedYear: 2018 },
  { id: "SD-B03", name: "Smoke detector — Server room", type: "smoke_detector", site: "B", location: "Level 1, server room", criticality: "high", capture: "panel", owner: FIRE_CONTRACTOR, inspectionIntervalDays: 90, inspectedDaysAgo: 40, installedYear: 2018 },
  { id: "SD-B04", name: "Smoke detector — Archive", type: "smoke_detector", site: "B", location: "Level 2, archive", criticality: "high", capture: "panel", owner: FIRE_CONTRACTOR, inspectionIntervalDays: 90, inspectedDaysAgo: 40, installedYear: 2018 },
  { id: "EL-B01", name: "Emergency light — Corridor L1", type: "emergency_light", site: "B", location: "Level 1 corridor", criticality: "high", capture: "iot", owner: FACILITIES, inspectionIntervalDays: 30, inspectedDaysAgo: 7, installedYear: 2018 },
  { id: "EL-B02", name: "Emergency light — Stairwell", type: "emergency_light", site: "B", location: "Main stairwell", criticality: "high", capture: "iot", owner: FACILITIES, inspectionIntervalDays: 30, inspectedDaysAgo: 7, installedYear: 2018 },
  { id: "FE-B01", name: "Extinguisher — Reception", type: "extinguisher", site: "B", location: "Reception desk", criticality: "medium", capture: "qr", owner: FIRE_CONTRACTOR, inspectionIntervalDays: 30, inspectedDaysAgo: 13, installedYear: 2023 },
  { id: "FE-B02", name: "Extinguisher — Server room (CO₂)", type: "extinguisher", site: "B", location: "Level 1, server room door", criticality: "medium", capture: "qr", owner: FIRE_CONTRACTOR, inspectionIntervalDays: 30, inspectedDaysAgo: 13, installedYear: 2023 },
  // Site C — industrial / electrical
  { id: "EP-C01", name: "Electrical panel — MSB 1", type: "electrical_panel", site: "C", location: "Substation, bay 1", criticality: "critical", capture: "iot", owner: ELEC_CONTRACTOR, inspectionIntervalDays: 90, inspectedDaysAgo: 30, installedYear: 2015 },
  { id: "EP-C02", name: "Electrical panel — MSB 2", type: "electrical_panel", site: "C", location: "Substation, bay 2", criticality: "critical", capture: "iot", owner: ELEC_CONTRACTOR, inspectionIntervalDays: 90, inspectedDaysAgo: 30, installedYear: 2019 },
  { id: "FP-C01", name: "Fire pump — Duty", type: "fire_pump", site: "C", location: "Pump house", criticality: "critical", capture: "panel", owner: FIRE_CONTRACTOR, inspectionIntervalDays: 7, inspectedDaysAgo: 3, installedYear: 2017 },
  { id: "HY-C01", name: "Hydrant — Gate 1", type: "hydrant", site: "C", location: "Main gate, kerbside", criticality: "high", capture: "qr", owner: FIRE_CONTRACTOR, inspectionIntervalDays: 90, inspectedDaysAgo: 45, installedYear: 2014 },
  { id: "HY-C02", name: "Hydrant — Loading bay", type: "hydrant", site: "C", location: "Loading bay 3", criticality: "high", capture: "qr", owner: FIRE_CONTRACTOR, inspectionIntervalDays: 90, inspectedDaysAgo: 98, installedYear: 2014 },
  { id: "FE-C01", name: "Extinguisher — Switch room", type: "extinguisher", site: "C", location: "Switch room entrance", criticality: "medium", capture: "qr", owner: FIRE_CONTRACTOR, inspectionIntervalDays: 30, inspectedDaysAgo: 18, installedYear: 2021 },
  { id: "FE-C02", name: "Extinguisher — Pump house", type: "extinguisher", site: "C", location: "Pump house door", criticality: "medium", capture: "qr", owner: FIRE_CONTRACTOR, inspectionIntervalDays: 30, inspectedDaysAgo: 18, installedYear: 2021 },
  { id: "SD-C01", name: "Smoke detector — Switch room", type: "smoke_detector", site: "C", location: "Switch room ceiling", criticality: "high", capture: "panel", owner: FIRE_CONTRACTOR, inspectionIntervalDays: 90, inspectedDaysAgo: 30, installedYear: 2016, connectivity: "stale" },
];

/** Deterministic noise so server and browser render identical demo data. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function telemetry(base: number, seed: number, temp: number, current: number): Reading[] {
  const r = rng(seed);
  const out: Reading[] = [];
  for (let i = 47; i >= 0; i--) {
    const t = base - i * 30 * 60_000;
    const daily = Math.sin((i / 48) * Math.PI * 2) * 0.9;
    out.push({
      t,
      temp: +(temp + daily + (r() - 0.5) * 0.8).toFixed(1),
      current: +(current + daily * 2 + (r() - 0.5) * 2).toFixed(1),
    });
  }
  return out;
}

export function createSeed(base: number): TownState {
  const assets: Asset[] = ASSETS.map(({ inspectedDaysAgo, condition, connectivity, ...a }) => ({
    ...a,
    condition: condition ?? "ok",
    connectivity: connectivity ?? (a.capture === "qr" ? "manual" : "online"),
    lastInspection: base - inspectedDaysAgo * DAY - 3 * HOUR,
  }));

  const faults: Fault[] = [
    { id: "F-H1", assetId: "EL-A03", severity: "high", description: "Battery failed 90-minute duration test", source: "Device heartbeat", detectedAt: base - 152 * DAY, resolvedAt: base - 150 * DAY },
    { id: "F-H2", assetId: "EL-A03", severity: "high", description: "Lamp failed self-test", source: "Device heartbeat", detectedAt: base - 61 * DAY, resolvedAt: base - 60 * DAY },
    { id: "F-H3", assetId: "SD-B03", severity: "low", description: "Detector dirty — contamination warning", source: "Panel status", detectedAt: base - 95 * DAY, resolvedAt: base - 92 * DAY },
    { id: "F-H4", assetId: "FE-C01", severity: "low", description: "Pressure gauge in amber zone", source: "QR inspection", detectedAt: base - 75 * DAY, resolvedAt: base - 74 * DAY },
  ];

  const workOrders: WorkOrder[] = [
    { id: "WO-0998", assetId: "EL-A03", faultId: "F-H2", title: "Replace lamp — failed self-test", priority: "P2", status: "closed", assignee: FACILITIES, createdAt: base - 61 * DAY, dueAt: base - 60 * DAY, acknowledgedAt: base - 61 * DAY + 2 * HOUR, closedAt: base - 60 * DAY, closedBy: "Supervisor Aina", evidence: { technician: "Tech. Hafiz", notes: "Lamp module replaced, self-test passed.", partReplaced: "LED lamp module", result: "pass", submittedAt: base - 60 * DAY - HOUR } },
    { id: "WO-0999", assetId: "FE-A02", title: "Monthly inspection overdue", priority: "P3", status: "open", assignee: FIRE_CONTRACTOR, createdAt: base - 4 * DAY, dueAt: base - 1 * DAY },
    { id: "WO-1000", assetId: "HY-C02", title: "Quarterly hydrant inspection overdue", priority: "P2", status: "in_progress", assignee: FIRE_CONTRACTOR, createdAt: base - 8 * DAY, dueAt: base - 7 * DAY, acknowledgedAt: base - 8 * DAY + 3 * HOUR },
  ];

  const audit: AuditEvent[] = [
    { id: "AU-S5", at: base - 2 * HOUR, actor: "TownShield AI", kind: "insight", message: "Data confidence reduced: EX-A02 and SD-C01 status not refreshed in 6 h.", assetId: "EX-A02" },
    { id: "AU-S4", at: base - 4 * DAY, actor: "Rules engine", kind: "work_order", message: "WO-0999 created — FE-A02 monthly inspection overdue (P3).", assetId: "FE-A02" },
    { id: "AU-S3", at: base - 8 * DAY, actor: "Rules engine", kind: "work_order", message: "WO-1000 created — HY-C02 quarterly inspection overdue (P2).", assetId: "HY-C02" },
    { id: "AU-S2", at: base - 12 * DAY, actor: "Tech. Hafiz", kind: "inspection", message: "EL-A02 inspection: battery at 68% capacity — marked degraded.", assetId: "EL-A02" },
    { id: "AU-S1", at: base - 60 * DAY, actor: "Supervisor Aina", kind: "verification", message: "WO-0998 verified and closed — EL-A03 lamp replaced.", assetId: "EL-A03" },
  ];

  return {
    sites: SITES,
    assets,
    faults,
    workOrders,
    audit,
    telemetry: {
      "EP-C01": telemetry(base, 7, 38.2, 412),
      "EP-C02": telemetry(base, 11, 36.4, 365),
    },
    seq: 1001,
  };
}
