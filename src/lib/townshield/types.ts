export type SiteId = "A" | "B" | "C";

export interface Site {
  id: SiteId;
  name: string;
  kind: string;
  description: string;
}

export type AssetType =
  | "fire_alarm_panel"
  | "emergency_light"
  | "exit_sign"
  | "extinguisher"
  | "smoke_detector"
  | "electrical_panel"
  | "fire_pump"
  | "hydrant";

export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  fire_alarm_panel: "Fire alarm panel",
  emergency_light: "Emergency light",
  exit_sign: "Exit sign",
  extinguisher: "Fire extinguisher",
  smoke_detector: "Smoke detector",
  electrical_panel: "Electrical panel",
  fire_pump: "Fire pump",
  hydrant: "Hydrant",
};

export type Criticality = "critical" | "high" | "medium" | "low";
export type Condition = "ok" | "degraded" | "fault";
export type CaptureMethod = "iot" | "panel" | "qr";
export type Connectivity = "online" | "stale" | "offline" | "manual";
export type Severity = "critical" | "high" | "low";
export type Priority = "P1" | "P2" | "P3";
export type WorkOrderStatus = "open" | "in_progress" | "awaiting_verification" | "closed";

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  site: SiteId;
  location: string;
  criticality: Criticality;
  condition: Condition;
  capture: CaptureMethod;
  connectivity: Connectivity;
  owner: string;
  lastInspection: number;
  inspectionIntervalDays: number;
  openFaultId?: string | undefined;
  installedYear: number;
}

export interface Fault {
  id: string;
  assetId: string;
  severity: Severity;
  description: string;
  source: string;
  detectedAt: number;
  resolvedAt?: number | undefined;
}

export interface Evidence {
  technician: string;
  notes: string;
  partReplaced?: string | undefined;
  photo?: string | undefined;
  result: "pass" | "fail";
  submittedAt: number;
}

export interface WorkOrder {
  id: string;
  assetId: string;
  faultId?: string | undefined;
  title: string;
  priority: Priority;
  status: WorkOrderStatus;
  assignee: string;
  createdAt: number;
  dueAt: number;
  acknowledgedAt?: number | undefined;
  evidence?: Evidence | undefined;
  closedAt?: number | undefined;
  closedBy?: string | undefined;
}

export type AuditKind =
  | "fault"
  | "work_order"
  | "inspection"
  | "verification"
  | "score"
  | "anomaly"
  | "insight"
  | "system";

export interface AuditEvent {
  id: string;
  at: number;
  actor: string;
  kind: AuditKind;
  message: string;
  assetId?: string | undefined;
}

export interface Reading {
  t: number;
  temp: number;
  current: number;
}

export interface TownState {
  sites: Site[];
  assets: Asset[];
  faults: Fault[];
  workOrders: WorkOrder[];
  audit: AuditEvent[];
  telemetry: Record<string, Reading[]>;
  seq: number;
}
