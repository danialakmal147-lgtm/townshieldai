import { describe, expect, it } from "vitest";

import { reducer } from "./engine";
import {
  SLA_HOURS,
  WEIGHTS,
  detectAnomaly,
  recurringFaults,
  scoreAsset,
  scoreGroup,
  workOrderPriority,
} from "./scoring";
import { createSeed } from "./seed";
import type { Asset, Fault } from "./types";

const NOW = Date.UTC(2026, 9, 22);
const DAY = 86_400_000;

function asset(over: Partial<Asset> = {}): Asset {
  return {
    id: "X1",
    name: "Test asset",
    type: "emergency_light",
    site: "A",
    location: "Here",
    criticality: "high",
    condition: "ok",
    capture: "iot",
    connectivity: "online",
    owner: "Team",
    lastInspection: NOW - 2 * DAY,
    inspectionIntervalDays: 30,
    installedYear: 2020,
    ...over,
  };
}

describe("readiness score", () => {
  it("uses the proposal weights 30/30/15/15/10", () => {
    expect(WEIGHTS).toEqual({ criticality: 30, condition: 30, inspection: 15, fault: 15, confidence: 10 });
  });

  it("gives a healthy, inspected, online asset 100", () => {
    expect(scoreAsset(asset(), undefined, NOW).score).toBe(100);
  });

  it("drops an asset by the full inspection weight when inspection is well overdue", () => {
    const s = scoreAsset(asset({ lastInspection: NOW - 60 * DAY, criticality: "low" }), undefined, NOW);
    expect(s.deductions.inspection).toBe(15);
  });

  it("keeps a critical unresolved fault as a red exception even when the overall score is high", () => {
    const healthy = Array.from({ length: 40 }, (_, i) => asset({ id: `H${i}` }));
    const fault: Fault = { id: "F1", assetId: "P1", severity: "critical", description: "Loop fault", source: "Panel", detectedAt: NOW };
    const panel = asset({ id: "P1", type: "fire_alarm_panel", criticality: "critical", condition: "fault", openFaultId: "F1" });
    const group = scoreGroup([...healthy, panel], new Map([["F1", fault]]), NOW);
    expect(group.score).toBeGreaterThanOrEqual(90);
    expect(group.exceptions.map((e) => e.assetId)).toEqual(["P1"]);
    expect(group.status).toBe("critical");
  });
});

describe("work order priority", () => {
  it("makes critical faults P1 with a 4 hour SLA", () => {
    expect(workOrderPriority("critical", "medium")).toBe("P1");
    expect(SLA_HOURS.P1).toBe(4);
  });
  it("makes a high-severity fault on a high asset P2 with a 24 hour SLA", () => {
    expect(workOrderPriority("high", "high")).toBe("P2");
    expect(SLA_HOURS.P2).toBe(24);
  });
});

describe("recurring faults", () => {
  const f = (daysAgo: number, id: string): Fault => ({ id, assetId: "A1", severity: "high", description: "", source: "", detectedAt: NOW - daysAgo * DAY });
  it("flags three faults within six months", () => {
    expect(recurringFaults([f(10, "1"), f(60, "2"), f(150, "3")], NOW)).toEqual([{ assetId: "A1", count: 3 }]);
  });
  it("ignores faults older than six months", () => {
    expect(recurringFaults([f(10, "1"), f(60, "2"), f(200, "3")], NOW)).toEqual([]);
  });
});

describe("anomaly detection", () => {
  const base = Array.from({ length: 24 }, (_, i) => 38 + (i % 3) * 0.3);
  it("does not alert on fewer than three abnormal readings", () => {
    expect(detectAnomaly([...base, 38.2, 48, 50]).anomalous).toBe(false);
  });
  it("alerts when three consecutive readings are far above baseline", () => {
    expect(detectAnomaly([...base, 45, 48, 50]).anomalous).toBe(true);
  });
});

describe("closed-loop workflow", () => {
  it("lowers the score on a failure and restores it after verified repair", () => {
    let s = createSeed(NOW);
    const before = scoreGroup(s.assets.filter((a) => a.site === "A"), new Map(s.faults.map((f) => [f.id, f])), NOW).score;
    s = reducer(s, { type: "raise_fault", assetId: "EL-A03", severity: "high", description: "Lamp failed", source: "Heartbeat", at: NOW });
    const wo = s.workOrders.find((w) => w.assetId === "EL-A03" && w.status === "open")!;
    expect(wo.priority).toBe("P2");
    const during = scoreGroup(s.assets.filter((a) => a.site === "A"), new Map(s.faults.map((f) => [f.id, f])), NOW).score;
    expect(during).toBeLessThan(before);
    expect(s.audit.some((e) => e.kind === "insight" && e.message.includes("EL-A03"))).toBe(true);

    s = reducer(s, { type: "submit_evidence", assetId: "EL-A03", failedItems: [], at: NOW + 1000, evidence: { technician: "T", notes: "Fixed", result: "pass", submittedAt: NOW + 1000 } });
    expect(s.workOrders.find((w) => w.id === wo.id)!.status).toBe("awaiting_verification");
    s = reducer(s, { type: "verify_close", woId: wo.id, actor: "Sup", at: NOW + 2000 });
    const after = scoreGroup(s.assets.filter((a) => a.site === "A"), new Map(s.faults.map((f) => [f.id, f])), NOW + 2000).score;
    expect(after).toBe(before);
  });
});
