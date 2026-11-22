import { useState } from "react";
import type { HistoryPoint } from "@/lib/telemetry/types";
import { historyTimestamps, historyValues } from "@/lib/telemetry/history";
import { formatPercent } from "@/lib/telemetry/format";
import { TelemetryChart } from "@/components/telemetry/TelemetryChart";
import { EmptyState } from "@/components/telemetry/TelemetryBits";

type Range = "60" | "120";

function currentValue(values: Array<number | null>): number | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value !== null && Number.isFinite(value)) return value;
  }
  return null;
}

export function TelemetryPulse({ history }: { history: HistoryPoint[] }) {
  const [range, setRange] = useState<Range>("120");
  const latest = history.length > 0 ? history[history.length - 1].t : 0;
  const windowed =
    range === "120" ? history : history.filter((point) => point.t >= latest - 60_000);

  const timestamps = historyTimestamps(windowed);
  const metrics = [
    {
      id: "cpu",
      label: "CPU",
      color: "var(--tm-cpu)",
      values: historyValues(windowed, "cpu"),
    },
    {
      id: "gpu",
      label: "GPU",
      color: "var(--tm-gpu)",
      values: historyValues(windowed, "gpu"),
    },
    {
      id: "memory",
      label: "Memory",
      color: "var(--tm-memory)",
      values: historyValues(windowed, "memory"),
    },
  ];

  return (
    <section className="tm-pulse tm-anchor" id="pulse" aria-labelledby="pulse-title">
      <div className="tm-pulse-head">
        <div>
          <span className="tm-kicker">Real-time pulse</span>
          <h2 id="pulse-title" className="tm-pulse-title">
            Last two minutes
          </h2>
        </div>
        <div className="tm-pulse-tools">
          <div className="tm-range-toggle" role="group" aria-label="Chart time range">
            <button type="button" data-active={range === "60"} onClick={() => setRange("60")}>
              60 s
            </button>
            <button type="button" data-active={range === "120"} onClick={() => setRange("120")}>
              120 s
            </button>
          </div>
          <div className="tm-pulse-meta">
            <span>500 ms stream</span>
            <span>Last {windowed.length} samples</span>
          </div>
        </div>
      </div>

      {windowed.length > 1 ? (
        <div className="tm-pulse-grid">
          {metrics.map((metric) => {
            const current = currentValue(metric.values);
            return (
              <article className="tm-pulse-card" key={metric.id}>
                <div className="tm-pulse-card-head">
                  <span className="tm-pulse-card-label" style={{ color: metric.color }}>
                    <i aria-hidden="true" />
                    {metric.label}
                  </span>
                  <strong className="tm-mono">
                    {current === null ? "—" : formatPercent(current)}
                  </strong>
                </div>
                <TelemetryChart
                  series={[
                    {
                      id: metric.id,
                      label: metric.label,
                      color: metric.color,
                      values: metric.values,
                    },
                  ]}
                  timestamps={timestamps}
                  height={60}
                  min={0}
                  unit="%"
                  ariaLabel={`${metric.label} utilisation history`}
                />
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          compact
          title="Waiting for history"
          description="The first samples are being collected from the telemetry API."
        />
      )}
    </section>
  );
}
