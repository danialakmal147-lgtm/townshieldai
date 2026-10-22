import {
  SLA_HOURS,
  detectAnomaly,
  recurringFaults,
  scoreGroup,
  workOrderPriority,
} from "./scoring";
import type {
  Asset,
  AuditEvent,
  Evidence,
  Fault,
  Severity,
  SiteId,
  TownState,
  WorkOrder,
} from "./types";

export type Action =
  | {
      type: "raise_fault";
      assetId: string;
      severity: Severity;
      description: string;
      source: string;
      at: number;
    }
  | { type: "simulate_anomaly"; assetId: string; at: number }
  | { type: "acknowledge"; woId: string; actor: string; at: number }
  | { type: "submit_evidence"; assetId: string; evidence: Evidence; failedItems: string[]; at: number }
  | { type: "verify_close"; woId: string; actor: string; at: number }
  | { type: "request_recheck"; woId: string; actor: string; at: number }
  | { type: "replace"; state: TownState };

export function faultMap(state: TownState) {
  return new Map<string, Fault>(state.faults.map((f) => [f.id, f]));
}

export function siteScore(state: TownState, site: SiteId, now: number) {
  return scoreGroup(
    state.assets.filter((a) => a.site === site),
    faultMap(state),
    now,
  );
}

export function activeWorkOrder(state: TownState, assetId: string) {
  return state.workOrders.find((w) => w.assetId === assetId && w.status !== "closed");
}

function audit(
  s: TownState,
  e: Omit<AuditEvent, "id">,
): TownState {
  return { ...s, seq: s.seq + 1, audit: [{ id: `AU-${s.seq}`, ...e }, ...s.audit] };
}

function updateAsset(s: TownState, id: string, patch: Partial<Asset>): TownState {
  return { ...s, assets: s.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)) };
}

function updateWO(s: TownState, id: string, patch: Partial<WorkOrder>): TownState {
  return { ...s, workOrders: s.workOrders.map((w) => (w.id === id ? { ...w, ...patch } : w)) };
}

function siteName(s: TownState, id: SiteId) {
  return s.sites.find((x) => x.id === id)?.name ?? `Site ${id}`;
}

function withScoreChange(before: TownState, after: TownState, site: SiteId, at: number, why: string) {
  const b = siteScore(before, site, at).score;
  const a = siteScore(after, site, at).score;
  if (a === b) return after;
  return audit(after, {
    at,
    actor: "Readiness engine",
    kind: "score",
    message: `${siteName(after, site)} readiness ${b} → ${a}. Reason: ${why}`,
  });
}

function raiseFault(
  s: TownState,
  assetId: string,
  severity: Severity,
  description: string,
  source: string,
  at: number,
): TownState {
  const asset = s.assets.find((a) => a.id === assetId);
  if (!asset || asset.openFaultId) return s;
  const fault: Fault = { id: `F-${s.seq}`, assetId, severity, description, source, detectedAt: at };
  const priority = workOrderPriority(severity, asset.criticality);
  const existing = activeWorkOrder(s, assetId);
  let next: TownState = {
    ...s,
    seq: s.seq + 1,
    faults: [...s.faults, fault],
  };
  next = updateAsset(next, assetId, {
    condition: "fault",
    openFaultId: fault.id,
    connectivity: asset.connectivity === "offline" ? "offline" : asset.connectivity,
  });
  next = audit(next, {
    at,
    actor: source,
    kind: "fault",
    message: `${asset.id} ${severity} fault detected — ${description}.`,
    assetId,
  });
  next = withScoreChange(s, next, asset.site, at + 1, `${asset.name}: ${description}`);

  if (existing) {
    next = updateWO(next, existing.id, {
      faultId: fault.id,
      priority,
      title: description,
      status: "open",
      dueAt: Math.min(existing.dueAt, at + SLA_HOURS[priority] * 3_600_000),
    });
    next = audit(next, {
      at: at + 2,
      actor: "TownShield AI",
      kind: "work_order",
      message: `${existing.id} escalated to ${priority} — ${description}.`,
      assetId,
    });
  } else {
    const wo: WorkOrder = {
      id: `WO-${next.seq}`,
      assetId,
      faultId: fault.id,
      title: description,
      priority,
      status: "open",
      assignee: asset.owner,
      createdAt: at,
      dueAt: at + SLA_HOURS[priority] * 3_600_000,
    };
    next = { ...next, seq: next.seq + 1, workOrders: [wo, ...next.workOrders] };
    next = audit(next, {
      at: at + 2,
      actor: "TownShield AI",
      kind: "work_order",
      message: `${wo.id} created (${priority}, SLA ${SLA_HOURS[priority]} h) and assigned to ${asset.owner}.`,
      assetId,
    });
  }

  const recurring = recurringFaults(next.faults, at).find((r) => r.assetId === assetId);
  if (recurring) {
    next = audit(next, {
      at: at + 3,
      actor: "TownShield AI",
      kind: "insight",
      message: `Recurring failure: ${assetId} has ${recurring.count} faults in 180 days. Recommend proactive replacement rather than another repair.`,
      assetId,
    });
  }
  return next;
}

export function reducer(s: TownState, action: Action): TownState {
  switch (action.type) {
    case "replace":
      return action.state;

    case "raise_fault":
      return raiseFault(s, action.assetId, action.severity, action.description, action.source, action.at);

    case "simulate_anomaly": {
      const series = s.telemetry[action.assetId];
      if (!series?.length) return s;
      const last = series[series.length - 1]!;
      const step = 30 * 60_000;
      const rise = [6.4, 9.1, 11.7];
      const added = rise.map((d, i) => ({
        t: Math.max(action.at - (rise.length - 1 - i) * 60_000, last.t + (i + 1) * step / 10),
        temp: +(last.temp + d).toFixed(1),
        current: +(last.current + d * 9).toFixed(1),
      }));
      const nextSeries = [...series, ...added];
      let next: TownState = { ...s, telemetry: { ...s.telemetry, [action.assetId]: nextSeries } };
      const result = detectAnomaly(nextSeries.map((r) => r.temp));
      const peak = added[added.length - 1]!.temp;
      next = audit(next, {
        at: action.at,
        actor: "Anomaly model",
        kind: "anomaly",
        message: result.anomalous
          ? `${action.assetId} temperature ${peak}°C is ${result.zScores.at(-1)!.toFixed(1)}σ above its ${result.mean.toFixed(1)}°C baseline for 3 consecutive readings.`
          : `${action.assetId} temperature spike observed but below persistence rule.`,
        assetId: action.assetId,
      });
      if (!result.anomalous) return next;
      return raiseFault(
        next,
        action.assetId,
        "high",
        `Abnormal temperature rise (+${(peak - result.mean).toFixed(1)}°C vs baseline)`,
        "Anomaly detection",
        action.at + 5,
      );
    }

    case "acknowledge": {
      const wo = s.workOrders.find((w) => w.id === action.woId);
      if (!wo || wo.status !== "open") return s;
      let next = updateWO(s, wo.id, { status: "in_progress", acknowledgedAt: wo.acknowledgedAt ?? action.at });
      next = audit(next, {
        at: action.at,
        actor: action.actor,
        kind: "work_order",
        message: `${wo.id} acknowledged — technician dispatched.`,
        assetId: wo.assetId,
      });
      return next;
    }

    case "submit_evidence": {
      const asset = s.assets.find((a) => a.id === action.assetId);
      if (!asset) return s;
      const { evidence, at } = action;
      const wo = activeWorkOrder(s, asset.id);

      if (wo && evidence.result === "pass") {
        let next = updateWO(s, wo.id, {
          status: "awaiting_verification",
          evidence,
          acknowledgedAt: wo.acknowledgedAt ?? at,
        });
        next = audit(next, {
          at,
          actor: evidence.technician,
          kind: "inspection",
          message: `QR scan on ${asset.id}: repair recorded${evidence.partReplaced ? ` (${evidence.partReplaced} replaced)` : ""}, evidence uploaded. ${wo.id} awaiting supervisor verification.`,
          assetId: asset.id,
        });
        return next;
      }

      if (evidence.result === "pass") {
        let next = updateAsset(s, asset.id, {
          lastInspection: at,
          condition: asset.condition === "degraded" && !evidence.partReplaced ? "degraded" : "ok",
        });
        next = audit(next, {
          at,
          actor: evidence.technician,
          kind: "inspection",
          message: `QR inspection on ${asset.id} passed. Inspection validity renewed.`,
          assetId: asset.id,
        });
        return withScoreChange(s, next, asset.site, at + 1, `${asset.name} inspected and passed`);
      }

      // Failed inspection
      let next = updateAsset(s, asset.id, { lastInspection: at });
      next = audit(next, {
        at,
        actor: evidence.technician,
        kind: "inspection",
        message: `QR inspection on ${asset.id} failed: ${action.failedItems.join(", ") || "see notes"}.`,
        assetId: asset.id,
      });
      if (wo) {
        next = updateWO(next, wo.id, { status: "in_progress", evidence });
        return next;
      }
      return raiseFault(
        next,
        asset.id,
        asset.criticality === "critical" ? "critical" : "high",
        `Failed inspection — ${action.failedItems[0] ?? "issue found"}`,
        "QR inspection",
        at + 5,
      );
    }

    case "verify_close": {
      const wo = s.workOrders.find((w) => w.id === action.woId);
      if (!wo || wo.status !== "awaiting_verification") return s;
      const asset = s.assets.find((a) => a.id === wo.assetId)!;
      let next = updateWO(s, wo.id, { status: "closed", closedAt: action.at, closedBy: action.actor });
      next = {
        ...next,
        faults: next.faults.map((f) =>
          f.id === wo.faultId && !f.resolvedAt ? { ...f, resolvedAt: action.at } : f,
        ),
      };
      next = updateAsset(next, asset.id, {
        condition: "ok",
        openFaultId: undefined,
        lastInspection: wo.evidence?.submittedAt ?? action.at,
        connectivity: asset.capture === "qr" ? "manual" : "online",
      });
      next = audit(next, {
        at: action.at,
        actor: action.actor,
        kind: "verification",
        message: `${wo.id} verified and closed. ${asset.id} restored to service.`,
        assetId: asset.id,
      });
      return withScoreChange(s, next, asset.site, action.at + 1, `${asset.name} repaired and verified`);
    }

    case "request_recheck": {
      const wo = s.workOrders.find((w) => w.id === action.woId);
      if (!wo || wo.status !== "awaiting_verification") return s;
      let next = updateWO(s, wo.id, { status: "in_progress" });
      next = audit(next, {
        at: action.at,
        actor: action.actor,
        kind: "verification",
        message: `${wo.id} evidence rejected — re-check requested.`,
        assetId: wo.assetId,
      });
      return next;
    }
  }
}
