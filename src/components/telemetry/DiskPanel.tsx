import { HardDrive } from "lucide-react";
import type { HistoryPoint, Snapshot } from "@/lib/telemetry/types";
import { historyTimestamps, historyValues, seriesPeak } from "@/lib/telemetry/history";
import { aggregateStorageIo } from "@/lib/telemetry/history";
import { storageKindLabel } from "@/lib/telemetry/derive";
import { formatDiskRate, formatNumber } from "@/lib/telemetry/format";
import { TelemetryPanel } from "@/components/telemetry/TelemetryPanel";
import { TelemetryChart } from "@/components/telemetry/TelemetryChart";
import { Stat } from "@/components/telemetry/TelemetryBits";

interface DiskPanelProps {
  snapshot: Snapshot;
  history: HistoryPoint[];
}

export function DiskPanel({ snapshot, history }: DiskPanelProps) {
  const timestamps = historyTimestamps(history);
  const readHistory = historyValues(history, "diskRead");
  const writeHistory = historyValues(history, "diskWrite");
  const io = aggregateStorageIo(snapshot);

  return (
    <TelemetryPanel
      id="disk"
      index="05"
      title="Disk I/O"
      subtitle="Read and write activity across all devices"
      meta={
        <span className="tm-network-rates">
          <span className="tm-mono">R {formatDiskRate(io.read)}</span>
          <span className="tm-mono">W {formatDiskRate(io.write)}</span>
        </span>
      }
    >
      <div className="tm-chart-block tm-chart-block-compact">
        <div className="tm-chart-caption">
          <span>
            <HardDrive size={13} strokeWidth={1.8} aria-hidden="true" /> Throughput history
          </span>
          <span>API history · bytes/s</span>
        </div>
        <TelemetryChart
          series={[
            { id: "read", label: "Read", color: "var(--tm-network)", values: readHistory },
            { id: "write", label: "Write", color: "var(--tm-storage)", values: writeHistory },
          ]}
          timestamps={timestamps}
          height={142}
          min={0}
          showLegend
          valueFormatter={(value) => formatDiskRate(value)}
          axisFormatter={(value) => {
            if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(0)}M`;
            if (value >= 1024) return `${(value / 1024).toFixed(0)}K`;
            return `${value.toFixed(0)}`;
          }}
          ariaLabel="Disk read and write throughput history"
        />
      </div>

      <div className="tm-stat-row tm-stat-row-three">
        <Stat label="Current read" value={formatDiskRate(io.read)} />
        <Stat label="Current write" value={formatDiskRate(io.write)} />
        <Stat label="Peak in view" value={formatDiskRate(Math.max(seriesPeak(readHistory), seriesPeak(writeHistory)))} hint="read or write" />
      </div>

      <div className="tm-table-shell tm-table-shell-compact">
        <table className="tm-table tm-disk-table">
          <thead>
            <tr>
              <th scope="col">Device</th>
              <th scope="col">Type</th>
              <th scope="col" className="tm-align-right">Read</th>
              <th scope="col" className="tm-align-right">Write</th>
              <th scope="col" className="tm-align-right">IOPS</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.storage.devices.map((device) => (
              <tr key={device.id}>
                <th scope="row">
                  <span className="tm-mono">{device.id}</span>
                  <small>{device.model}</small>
                </th>
                <td>{storageKindLabel(device.kind)}</td>
                <td className="tm-align-right tm-mono">{formatDiskRate(device.readBytesPerSecond)}</td>
                <td className="tm-align-right tm-mono">{formatDiskRate(device.writeBytesPerSecond)}</td>
                <td className="tm-align-right tm-mono">{formatNumber(device.iops, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="tm-panel-note">
        The current snapshot exposes instantaneous rates and IOPS, not cumulative disk byte counters.
      </p>
    </TelemetryPanel>
  );
}
