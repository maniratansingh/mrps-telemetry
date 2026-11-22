import { MemoryStick } from "lucide-react";
import type { HistoryPoint, Snapshot } from "@/lib/telemetry/types";
import { historyTimestamps, historyValues } from "@/lib/telemetry/history";
import { percentUsed } from "@/lib/telemetry/derive";
import { formatBytes, formatPercent } from "@/lib/telemetry/format";
import { TelemetryPanel } from "@/components/telemetry/TelemetryPanel";
import { TelemetryChart } from "@/components/telemetry/TelemetryChart";
import { Meter, Stat } from "@/components/telemetry/TelemetryBits";

interface MemoryPanelProps {
  snapshot: Snapshot;
  history: HistoryPoint[];
}

export function MemoryPanel({ snapshot, history }: MemoryPanelProps) {
  const memory = snapshot.memory;
  const timestamps = historyTimestamps(history);
  const memoryHistory = historyValues(history, "memory");
  const usedPercent = percentUsed(memory.usedBytes, memory.totalBytes);
  const swapPercent = percentUsed(memory.swapUsedBytes, memory.swapTotalBytes);
  const total = memory.totalBytes || 1;

  const segments = [
    { id: "used", label: "Used", value: memory.usedBytes, color: "var(--tm-memory)" },
    { id: "cached", label: "Cached", value: memory.cachedBytes, color: "var(--tm-memory-soft)" },
    { id: "buffers", label: "Buffers", value: memory.buffersBytes, color: "var(--tm-cpu-soft)" },
    { id: "free", label: "Free", value: memory.freeBytes, color: "var(--tm-track)" },
  ];

  return (
    <TelemetryPanel
      id="memory"
      index="03"
      title="Memory"
      subtitle="Physical allocation and reclaimable cache"
      meta={
        <span className="tm-panel-current tm-mono">
          {formatPercent(usedPercent)}
          <small>used</small>
        </span>
      }
    >
      <div className="tm-memory-headline">
        <div>
          <strong className="tm-mono">{formatBytes(memory.usedBytes)}</strong>
          <span>of {formatBytes(memory.totalBytes)}</span>
        </div>
        <span className="tm-memory-available">{formatBytes(memory.availableBytes)} available</span>
      </div>

      <div className="tm-composition" aria-label="Memory composition">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <span
              key={segment.id}
              style={{
                width: `${(segment.value / total) * 100}%`,
                background: segment.color,
              }}
              title={`${segment.label}: ${formatBytes(segment.value)}`}
            />
          ))}
      </div>

      <div className="tm-composition-legend">
        {segments.map((segment) => (
          <div key={segment.id}>
            <span>
              <i style={{ background: segment.color }} aria-hidden="true" />
              {segment.label}
            </span>
            <strong className="tm-mono">{formatBytes(segment.value)}</strong>
          </div>
        ))}
      </div>

      <div className="tm-swap">
        <div className="tm-subsection-head">
          <div>
            <span className="tm-kicker">Swap</span>
            <h3>
              {formatBytes(memory.swapUsedBytes)} <span>of {formatBytes(memory.swapTotalBytes)}</span>
            </h3>
          </div>
          <span className="tm-subsection-note">{formatPercent(swapPercent)}</span>
        </div>
        <Meter value={swapPercent} color="var(--tm-memory)" label="Swap utilisation" />
      </div>

      <div className="tm-stat-row tm-stat-row-three">
        <Stat label="Available" value={formatBytes(memory.availableBytes)} />
        <Stat label="Cached" value={formatBytes(memory.cachedBytes)} />
        <Stat label="Buffers" value={formatBytes(memory.buffersBytes)} />
      </div>

      <div className="tm-chart-block tm-chart-block-compact">
        <div className="tm-chart-caption">
          <span>
            <MemoryStick size={13} strokeWidth={1.8} aria-hidden="true" /> Memory utilisation
          </span>
          <span>API history</span>
        </div>
        <TelemetryChart
          series={[{ id: "memory", label: "Memory", color: "var(--tm-memory)", values: memoryHistory }]}
          timestamps={timestamps}
          height={126}
          min={0}
          unit="%"
          axisFormatter={(value) => `${Math.round(value)}%`}
          ariaLabel={`Memory utilisation history, currently ${formatPercent(usedPercent)}`}
        />
      </div>
    </TelemetryPanel>
  );
}
