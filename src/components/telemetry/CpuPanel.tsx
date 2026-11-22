import * as React from "react";
import { Activity, Cpu } from "lucide-react";
import type { HostInfo, Snapshot } from "@/lib/telemetry/types";
import type { HistoryPoint } from "@/lib/telemetry/types";
import { historyTimestamps, historyValues } from "@/lib/telemetry/history";
import {
  formatLoadAverages,
  formatNumber,
  formatPercent,
  formatTemp,
} from "@/lib/telemetry/format";
import { TelemetryPanel } from "@/components/telemetry/TelemetryPanel";
import { TelemetryChart } from "@/components/telemetry/TelemetryChart";
import { Meter, Stat } from "@/components/telemetry/TelemetryBits";
import { EmptyState } from "@/components/telemetry/TelemetryBits";

interface CpuPanelProps {
  host: HostInfo | null;
  snapshot: Snapshot;
  history: HistoryPoint[];
}

export function CpuPanel({ host, snapshot, history }: CpuPanelProps) {
  const cpu = snapshot.cpu;
  const timestamps = historyTimestamps(history);
  const cpuHistory = historyValues(history, "cpu");
  const cores = host?.spec.cpu.physicalCores ?? cpu.perCore.length;
  const threads = host?.spec.cpu.logicalThreads ?? cpu.perThread.length;
  const model = host?.spec.cpu.model ?? "Processor model not reported";
  const [detailOpen, setDetailOpen] = React.useState(true);

  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 700px) and (max-width: 1599px)");
    const update = () => setDetailOpen(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <TelemetryPanel
      id="cpu"
      index="01"
      title="Processor"
      subtitle={model}
      meta={
        <span className="tm-panel-current tm-mono">
          {formatPercent(cpu.usagePercent)}
          <small>now</small>
        </span>
      }
    >
      <div className="tm-chart-block">
        <div className="tm-chart-caption">
          <span>
            <Activity size={13} strokeWidth={1.8} aria-hidden="true" /> Utilisation history
          </span>
          <span>API history · auto-scaled</span>
        </div>
        <TelemetryChart
          series={[{ id: "cpu", label: "CPU utilisation", color: "var(--tm-cpu)", values: cpuHistory }]}
          timestamps={timestamps}
          height={150}
          min={0}
          unit="%"
          axisFormatter={(value) => `${Math.round(value)}%`}
          ariaLabel={`CPU utilisation history, currently ${formatPercent(cpu.usagePercent)}`}
        />
      </div>

      <div className="tm-stat-row">
        <Stat label="Package temp" value={formatTemp(cpu.temperatureC)} hint="k10temp" />
        <Stat label="Frequency" value={cpu.frequencyGhz.toFixed(2)} unit="GHz" hint="current average" />
        <Stat label="Load average" value={formatLoadAverages(cpu.loadAverage)} hint="1m / 5m / 15m" />
        <Stat label="Processes" value={formatNumber(cpu.processCount)} hint={`${threads} logical threads`} />
      </div>

      <details
        className="tm-cpu-details"
        open={detailOpen}
        onToggle={(event) => setDetailOpen(event.currentTarget.open)}
      >
        <summary>
          <span>Core &amp; thread detail</span>
          <span className="tm-mono">{cores} cores · {threads} threads</span>
        </summary>

      <div className="tm-subsection">
        <div className="tm-subsection-head">
          <div>
            <span className="tm-kicker">Physical cores</span>
            <h3>{cores} cores</h3>
          </div>
          <span className="tm-subsection-note">Reported by the CPU collector</span>
        </div>
        <div className="tm-core-grid">
          {cpu.perCore.length > 0 ? (
            cpu.perCore.map((core) => (
              <div className="tm-core-row" key={core.index}>
                <span className="tm-mono">C{String(core.index + 1).padStart(2, "0")}</span>
                <Meter
                  value={core.usagePercent}
                  color="var(--tm-cpu)"
                  label={`Core ${core.index + 1} utilisation`}
                />
                <strong className="tm-mono">{formatPercent(core.usagePercent)}</strong>
              </div>
            ))
          ) : (
            <EmptyState compact title="Per-core data unavailable" />
          )}
        </div>
      </div>

      <div className="tm-subsection">
        <div className="tm-subsection-head">
          <div>
            <span className="tm-kicker">Logical threads</span>
            <h3>{threads} threads</h3>
          </div>
          <span className="tm-subsection-note">Utilisation and clock are reported per thread</span>
        </div>
        <div className="tm-thread-grid" role="img" aria-label={`${threads} logical thread utilisation values`}>
          {cpu.perThread.length > 0 ? (
            cpu.perThread.map((thread) => (
              <span
                className="tm-thread"
                key={thread.index}
                title={`Thread ${String(thread.index + 1).padStart(2, "0")} · ${formatPercent(
                  thread.usagePercent,
                )}${thread.clockGhz ? ` · ${thread.clockGhz.toFixed(2)} GHz` : ""}`}
              >
                <span className="tm-thread-track" aria-hidden="true">
                  <span style={{ height: `${Math.max(2, thread.usagePercent)}%` }} />
                </span>
                <span className="tm-thread-label">{String(thread.index + 1).padStart(2, "0")}</span>
              </span>
            ))
          ) : (
            <span className="tm-inline-note">No per-thread values were returned by the API.</span>
          )}
        </div>
      </div>

      </details>

      <p className="tm-panel-note">
        <Cpu size={13} strokeWidth={1.8} aria-hidden="true" />
        Per-core temperature, package power and throttling state are not exposed by the current telemetry API.
      </p>
    </TelemetryPanel>
  );
}
