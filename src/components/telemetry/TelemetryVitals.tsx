import {
  CircuitBoard,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Thermometer,
} from "lucide-react";
import type { HostInfo, Snapshot } from "@/lib/telemetry/types";
import { hottestSensor, percentUsed, storageSummary } from "@/lib/telemetry/derive";
import {
  formatBitRate,
  formatBytes,
  formatPercent,
  formatTemp,
} from "@/lib/telemetry/format";
import { RadialGauge } from "@/components/telemetry/TelemetryBits";

export function TelemetryVitals({ snapshot, host }: { snapshot: Snapshot; host: HostInfo | null }) {
  const cpu = snapshot.cpu;
  const gpu = snapshot.gpu;
  const memory = snapshot.memory;
  const storage = storageSummary(snapshot.storage.devices);
  const hottest = hottestSensor(snapshot.thermal.sensors);
  const memoryPercent = percentUsed(memory.usedBytes, memory.totalBytes);

  return (
    <section className="tm-vitals" aria-label="Machine vitals">
      <article className="tm-vital" data-tone="cpu">
        <div className="tm-vital-head">
          <span className="tm-vital-icon">
            <Cpu size={14} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span>CPU</span>
        </div>
        <div className="tm-vital-reading">
          <strong className="tm-vital-value tm-mono">{formatPercent(cpu.usagePercent)}</strong>
          <RadialGauge value={cpu.usagePercent} color="var(--tm-cpu)" label="CPU utilisation" />
        </div>
        <p className="tm-vital-sub">
          {formatTemp(cpu.temperatureC)} <span>·</span> {cpu.frequencyGhz.toFixed(2)} GHz
        </p>
      </article>

      <article className="tm-vital" data-tone="gpu">
        <div className="tm-vital-head">
          <span className="tm-vital-icon">
            <CircuitBoard size={14} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span>GPU</span>
        </div>
        <div className="tm-vital-reading">
          <strong className="tm-vital-value tm-mono">{gpu ? formatPercent(gpu.usagePercent) : "—"}</strong>
          <RadialGauge
            value={gpu ? gpu.usagePercent : null}
            color="var(--tm-gpu)"
            label="GPU utilisation"
          />
        </div>
        <p className="tm-vital-sub">
          {gpu
            ? `${formatTemp(gpu.temperatureC)} · ${formatBytes(gpu.vramUsedBytes)} VRAM`
            : host?.spec.gpu
              ? `${host.spec.gpu.vendor} ${host.spec.gpu.model} · no metrics`
              : "No GPU detected"}
        </p>
      </article>

      <article className="tm-vital" data-tone="memory">
        <div className="tm-vital-head">
          <span className="tm-vital-icon">
            <MemoryStick size={14} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span>Memory</span>
        </div>
        <div className="tm-vital-reading">
          <strong className="tm-vital-value tm-mono">{formatPercent(memoryPercent)}</strong>
          <RadialGauge value={memoryPercent} color="var(--tm-memory)" label="Memory utilisation" />
        </div>
        <p className="tm-vital-sub">
          {formatBytes(memory.usedBytes)} <span>of</span> {formatBytes(memory.totalBytes)}
        </p>
      </article>

      <article className="tm-vital" data-tone="storage">
        <div className="tm-vital-head">
          <span className="tm-vital-icon">
            <HardDrive size={14} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span>Storage</span>
        </div>
        <div className="tm-vital-reading">
          <strong className="tm-vital-value tm-mono">{formatPercent(storage.percent)}</strong>
          <RadialGauge value={storage.percent} color="var(--tm-storage)" label="Storage utilisation" />
        </div>
        <p className="tm-vital-sub">
          {formatBytes(storage.usedBytes)} <span>of</span> {formatBytes(storage.capacityBytes)}
        </p>
      </article>

      <article className="tm-vital" data-tone="network">
        <div className="tm-vital-head">
          <span className="tm-vital-icon">
            <Network size={14} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span>Network</span>
        </div>
        <strong className="tm-vital-value tm-mono">{formatBitRate(snapshot.network.rxBytesPerSecond)}</strong>
        <p className="tm-vital-sub">
          <span>↓</span> {formatBitRate(snapshot.network.rxBytesPerSecond)}
          <span>·</span>
          <span>↑</span> {formatBitRate(snapshot.network.txBytesPerSecond)}
        </p>
        <p className="tm-vital-foot">
          {formatBytes(snapshot.network.rxTotalBytes, 0)} received
        </p>
      </article>

      <article className="tm-vital" data-tone="thermal">
        <div className="tm-vital-head">
          <span className="tm-vital-icon">
            <Thermometer size={14} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span>Thermal</span>
        </div>
        <strong className="tm-vital-value tm-mono">{formatTemp(hottest?.valueC)}</strong>
        <p className="tm-vital-sub">
          {snapshot.thermal.sensors.length} sensors <span>·</span> {snapshot.thermal.fans.length} fans
        </p>
        <p className="tm-vital-foot">{hottest?.label ?? "No sensor reported"}</p>
      </article>
    </section>
  );
}
