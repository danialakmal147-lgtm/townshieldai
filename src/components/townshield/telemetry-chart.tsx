import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { detectAnomaly } from "@/lib/townshield/scoring";
import type { Reading } from "@/lib/townshield/types";

export function TelemetryChart({ readings, height = 240 }: { readings: Reading[]; height?: number }) {
  const result = detectAnomaly(readings.map((r) => r.temp));
  const data = readings.map((r) => ({
    time: new Date(r.t).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kuala_Lumpur" }),
    temp: r.temp,
    current: r.current,
  }));
  const max = Math.max(...readings.map((r) => r.temp), result.upper || 0) + 2;
  const min = Math.min(...readings.map((r) => r.temp)) - 2;

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} interval={7} />
            <YAxis domain={[Math.floor(min), Math.ceil(max)]} tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} unit="°" />
            <Tooltip
              contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "var(--color-muted-foreground)" }}
            />
            {result.upper > 0 && (
              <ReferenceLine
                y={+result.upper.toFixed(1)}
                stroke="var(--color-warning)"
                strokeDasharray="4 4"
                label={{ value: "3σ limit", fill: "var(--color-warning)", fontSize: 10, position: "insideTopLeft" }}
              />
            )}
            <Area type="monotone" dataKey="temp" stroke="none" fill="url(#tempFill)" />
            <Line type="monotone" dataKey="temp" name="Temp °C" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        Baseline {result.mean.toFixed(1)}°C · σ {result.std.toFixed(2)} · persistence rule: 3 consecutive readings ≥ 3σ ·{" "}
        {result.anomalous ? <span className="text-critical">ANOMALY</span> : <span className="text-success">normal</span>}
      </p>
    </div>
  );
}
