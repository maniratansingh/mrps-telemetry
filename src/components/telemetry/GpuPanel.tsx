import { CircuitBoard, Gauge } from "lucide-react";
import type { HistoryPoint, HostInfo, Snapshot } from "@/lib/telemetry/types";
import { historyTimestamps, historyValues } from "@/lib/telemetry/history";
import { percentUsed } from "@/lib/telemetry/derive";
import {
  formatBytes,
  formatNumber,
  formatPercent,
  formatTemp,
} from "@/lib/telemetry/format";
import { TelemetryPanel } from "@/components/telemetry/TelemetryPanel";
import { TelemetryChart } from "@/components/telemetry/TelemetryChart";
import { EmptyState, Meter, Stat } from "@/components/telemetry/TelemetryBits";

interface GpuPanelProps {
  host: HostInfo | null;
  snapshot: Snapshot;
  history: HistoryPoint[];
}

export function GpuPanel({ host, snapshot, history }: GpuPanelProps) {
  const gpu = snapshot.gpu;
  const timestamps = historyTimestamps(history);
  const gpuHistory = historyValues(history, "gpu");

  if (!gpu) {
    const detected = host?.spec.gpu;
    return (
      <TelemetryPanel
        id="gpu"
        index="02"
        title="Graphics"
        subtitle={detected ? `${detected.vendor} GPU detected` : "No GPU telemetry reported"}
      >
        <EmptyState
          icon={CircuitBoard}
          title={detected ? "No vendor metrics" : "No GPU telemetry"}
          description={
            detected
              ? `${detected.model}${detected.driver ? ` · driver ${detected.driver}` : ""}. Detailed GPU metrics come from nvidia-smi only; no values are inferred for this adapter.`
              : "The snapshot did not include a GPU object. No graphics values are inferred."
          }
        />
      </TelemetryPanel>
    );
  }

  const vramPercent = percentUsed(gpu.vramUsedBytes, gpu.vramTotalBytes);
  const driver = host?.spec.gpu?.driver;

  return (
    <TelemetryPanel
      id="gpu"
      index="02"
      title="Graphics"
      subtitle={`${gpu.model}${driver ? ` · driver ${driver}` : ""}`}
      meta={
        <span className="tm-panel-current tm-mono">
          {formatPercent(gpu.usagePercent)}
          <small>now</small>
        </span>
      }
    >
      <div className="tm-chart-block">
        <div className="tm-chart-caption">
          <span>
            <Gauge size={13} strokeWidth={1.8} aria-hidden="true" /> GPU utilisation
          </span>
          <span>API history · auto-scaled</span>
        </div>
        <TelemetryChart
          series={[{ id: "gpu", label: "GPU", color: "var(--tm-gpu)", values: gpuHistory }]}
          timestamps={timestamps}
          height={160}
          min={0}
          unit="%"
          axisFormatter={(value) => `${Math.round(value)}%`}
          ariaLabel={`GPU utilisation history, currently ${formatPercent(gpu.usagePercent)}`}
        />
      </div>

      <div className="tm-stat-row tm-stat-row-three">
        <Stat label="Temperature" value={formatTemp(gpu.temperatureC)} hint="reported by driver" />
        <Stat
          label="Power"
          value={gpu.powerWatts === null ? "—" : formatNumber(gpu.powerWatts, 1)}
          unit={gpu.powerWatts === null ? undefined : "W"}
          hint={gpu.powerWatts === null ? "not exposed by driver" : "instantaneous"}
        />
        <Stat
          label="Fan"
          value={gpu.fanPercent === null ? "—" : formatPercent(gpu.fanPercent, 0)}
          hint={gpu.fanPercent === null ? "not reported" : gpu.fanPercent === 0 ? "0% · fan stop" : "reported by driver"}
        />
      </div>

      {gpu.powerWatts === null ? (
        <p className="tm-inline-note">
          Power draw is not exposed by this driver (nvidia-smi returns N/A). It is not zero.
        </p>
      ) : null}

      <div className="tm-vram">
        <div className="tm-subsection-head">
          <div>
            <span className="tm-kicker">VRAM</span>
            <h3>
              {formatBytes(gpu.vramUsedBytes)} <span>of {formatBytes(gpu.vramTotalBytes)}</span>
            </h3>
          </div>
          <span className="tm-subsection-note">
            {gpu.memoryUtilizationPercent === null
              ? "memory controller utilisation not reported"
              : `${formatPercent(gpu.memoryUtilizationPercent, 0)} memory controller`}
          </span>
        </div>
        <Meter value={vramPercent} color="var(--tm-gpu)" label="VRAM utilisation" />
        <div className="tm-vram-legend">
          <span>
            <i style={{ background: "var(--tm-gpu)" }} /> Allocated {formatBytes(gpu.vramUsedBytes)}
          </span>
          <span>{formatBytes(Math.max(0, gpu.vramTotalBytes - gpu.vramUsedBytes))} free</span>
        </div>
      </div>

      <div className="tm-stat-row tm-stat-row-three">
        <Stat
          label="Core clock"
          value={gpu.coreClockMhz === null ? "—" : formatNumber(gpu.coreClockMhz)}
          unit={gpu.coreClockMhz === null ? undefined : "MHz"}
        />
        <Stat
          label="Memory clock"
          value={gpu.memoryClockMhz === null ? "—" : formatNumber(gpu.memoryClockMhz)}
          unit={gpu.memoryClockMhz === null ? undefined : "MHz"}
        />
        <Stat label="VRAM total" value={formatBytes(gpu.vramTotalBytes)} hint="adapter capacity" />
      </div>

      <div className="tm-gpu-processes">
        <div className="tm-subsection-head">
          <div>
            <span className="tm-kicker">GPU processes</span>
            <h3>{snapshot.processes.gpu.length} active</h3>
          </div>
          <span className="tm-subsection-note">No command lines are exposed</span>
        </div>
        {snapshot.processes.gpu.length === 0 ? (
          <EmptyState
            compact
            title="No GPU processes reported"
            description="The API returned an empty GPU process list."
          />
        ) : (
          <div className="tm-mini-list">
            {snapshot.processes.gpu.map((process) => (
              <div className="tm-mini-row" key={`${process.pid}-${process.name}`}>
                <span className="tm-mono">{process.pid}</span>
                <span>{process.name}</span>
                <span className="tm-mono">
                  {process.usagePercent === null || process.usagePercent === undefined
                    ? "—"
                    : formatPercent(process.usagePercent)}
                </span>
                <span className="tm-mono">
                  {process.vramBytes === undefined ? "—" : formatBytes(process.vramBytes)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </TelemetryPanel>
  );
}
