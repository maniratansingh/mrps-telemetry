import { useState } from "react";
import type { HistoryPoint } from "@/lib/telemetry/types";
import { historyTimestamps, historyValues } from "@/lib/telemetry/history";
import { TelemetryChart } from "@/components/telemetry/TelemetryChart";
import { EmptyState } from "@/components/telemetry/TelemetryBits";

type Range = "60" | "120";

export function TelemetryPulse({ history }: { history: HistoryPoint[] }) {
  const [range, setRange] = useState<Range>("120");
  const latest = history.length > 0 ? history[history.length - 1].t : 0;
  const windowed =
    range === "120" ? history : history.filter((point) => point.t >= latest - 60_000);

  const timestamps = historyTimestamps(windowed);
  const cpu = historyValues(windowed, "cpu");
  const gpu = historyValues(windowed, "gpu");
  const memory = historyValues(windowed, "memory");

  return (
    <section className="tm-pulse tm-anchor" id="pulse" aria-labelledby="pulse-title">
      <div className="tm-pulse-head">
        <div>
          <span className="tm-kicker">Live signal</span>
          <h2 id="pulse-title" className="tm-pulse-title">
            System pulse
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
            <span>CPU · GPU · MEMORY</span>
            <span>Last {windowed.length} samples</span>
          </div>
        </div>
      </div>

      {windowed.length > 1 ? (
        <TelemetryChart
          series={[
            { id: "cpu", label: "CPU", color: "var(--tm-cpu)", values: cpu },
            { id: "gpu", label: "GPU", color: "var(--tm-gpu)", values: gpu },
            { id: "memory", label: "Memory", color: "var(--tm-memory)", values: memory },
          ]}
          timestamps={timestamps}
          height={230}
          min={0}
          unit="%"
          showLegend
          ariaLabel="CPU, GPU and memory utilisation history"
        />
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
