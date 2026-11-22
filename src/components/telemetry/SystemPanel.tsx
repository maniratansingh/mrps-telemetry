import { Database, Server, ShieldCheck } from "lucide-react";
import type { ApiHealth, HostInfo, Snapshot } from "@/lib/telemetry/types";
import {
  formatBytes,
  formatDateOnly,
  formatLoadAverages,
  formatNumber,
  formatTimestamp,
  formatUptime,
  readableApiHost,
} from "@/lib/telemetry/format";
import { TelemetryPanel } from "@/components/telemetry/TelemetryPanel";

interface SystemPanelProps {
  host: HostInfo | null;
  snapshot: Snapshot;
  health: ApiHealth | null;
  apiBase: string;
  pollIntervalMs: number;
}

function Capability({ label, value, tone }: { label: string; value: string; tone?: "ok" | "muted" }) {
  return (
    <span className={`tm-capability tm-capability-${tone ?? "default"}`}>
      <i>{label}</i>
      <b>{value}</b>
    </span>
  );
}

export function SystemPanel({ host, snapshot, health, apiBase, pollIntervalMs }: SystemPanelProps) {
  const system = snapshot.system;
  const gpu = host?.spec.gpu ?? snapshot.gpu;
  const caps = host?.capabilities;
  const storageCount = snapshot.storage.devices.length;

  return (
    <TelemetryPanel
      id="system"
      index="10"
      title="System"
      subtitle="Host identity, hardware and API provenance"
      meta={<span className="tm-mono tm-system-host">{system.hostname}</span>}
    >
      <div className="tm-system-grid">
        <div className="tm-system-block">
          <span className="tm-kicker">Identity</span>
          <dl className="tm-definition-list">
            <div>
              <dt>Hostname</dt>
              <dd className="tm-mono">{system.hostname}</dd>
            </div>
            <div>
              <dt>Operating system</dt>
              <dd>{system.os}</dd>
            </div>
            <div>
              <dt>Kernel</dt>
              <dd className="tm-mono">{system.kernel}</dd>
            </div>
            <div>
              <dt>Architecture</dt>
              <dd className="tm-mono">{system.arch}</dd>
            </div>
            <div>
              <dt>IPv4</dt>
              <dd className="tm-mono">{host?.ipv4 ?? "—"}</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{system.timezone}</dd>
            </div>
          </dl>
        </div>

        <div className="tm-system-block">
          <span className="tm-kicker">Runtime</span>
          <dl className="tm-definition-list">
            <div>
              <dt>Uptime</dt>
              <dd className="tm-mono">{formatUptime(system.uptimeSeconds)}</dd>
            </div>
            <div>
              <dt>Boot time</dt>
              <dd>{formatTimestamp(system.bootTime, system.timezone)}</dd>
            </div>
            <div>
              <dt>Load average</dt>
              <dd className="tm-mono">{formatLoadAverages(snapshot.cpu.loadAverage)}</dd>
            </div>
            <div>
              <dt>Processes</dt>
              <dd className="tm-mono">{formatNumber(system.processCount)}</dd>
            </div>
            <div>
              <dt>Logical threads</dt>
              <dd className="tm-mono">{snapshot.cpu.perThread.length}</dd>
            </div>
            <div>
              <dt>Last sample</dt>
              <dd>{formatTimestamp(snapshot.timestamp, system.timezone)}</dd>
            </div>
          </dl>
        </div>

        <div className="tm-system-block">
          <span className="tm-kicker">Hardware</span>
          <dl className="tm-definition-list">
            <div>
              <dt>Processor</dt>
              <dd>{host?.spec.cpu.model ?? "Not reported"}</dd>
            </div>
            <div>
              <dt>Cores / threads</dt>
              <dd className="tm-mono">
                {host ? `${host.spec.cpu.physicalCores} / ${host.spec.cpu.logicalThreads}` : "—"}
              </dd>
            </div>
            <div>
              <dt>Memory</dt>
              <dd className="tm-mono">{formatBytes(snapshot.memory.totalBytes)}</dd>
            </div>
            <div>
              <dt>Graphics</dt>
              <dd>{gpu?.model ?? "No GPU reported"}</dd>
            </div>
            <div>
              <dt>Storage devices</dt>
              <dd className="tm-mono">{storageCount}</dd>
            </div>
            <div>
              <dt>Network interfaces</dt>
              <dd className="tm-mono">{snapshot.network.interfaces.length}</dd>
            </div>
          </dl>
        </div>

        <div className="tm-system-block tm-system-provenance">
          <span className="tm-kicker">Telemetry provenance</span>
          <div className="tm-provenance-row">
            <ShieldCheck size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>Read-only API</span>
            <strong className="tm-mono">{health?.status ?? "unknown"}</strong>
          </div>
          <div className="tm-provenance-row">
            <Server size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>Endpoint</span>
            <strong className="tm-mono">{readableApiHost(apiBase)}</strong>
          </div>
          <div className="tm-provenance-row">
            <Database size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>History</span>
            <strong>120 samples · in-memory</strong>
          </div>
          <div className="tm-provenance-row">
            <span className="tm-provenance-dot" aria-hidden="true" />
            <span>Polling</span>
            <strong className="tm-mono">
              {pollIntervalMs < 1000 ? `${pollIntervalMs} ms` : `${(pollIntervalMs / 1000).toFixed(0)} s`}
            </strong>
          </div>
          <div className="tm-provenance-note">
            <span>Boot date</span>
            <span>{formatDateOnly(system.bootTime, system.timezone)}</span>
          </div>
        </div>
      </div>

      {caps?.checks?.length ? (
        <div className="tm-readiness">
          <div className="tm-readiness-head">
            <div>
              <span className="tm-kicker">System readiness</span>
              <h3>What this host can and cannot report</h3>
            </div>
            <div className="tm-readiness-summary">
              <span className="tm-check-pill tm-check-pill-ok">{caps.summary.ok} ready</span>
              <span className="tm-check-pill tm-check-pill-warn">{caps.summary.warn} limited</span>
              <span className="tm-check-pill tm-check-pill-missing">{caps.summary.missing} missing</span>
            </div>
          </div>
          <ul className="tm-check-list">
            {caps.checks.map((check) => (
              <li key={check.id} className={`tm-check tm-check-${check.status}`}>
                <span className="tm-check-dot" aria-hidden="true" />
                <div className="tm-check-body">
                  <strong>{check.label}</strong>
                  <p>{check.detail}</p>
                  {check.remedy ? <code>{check.remedy}</code> : null}
                </div>
                <span className="tm-check-state">
                  {check.status === "ok" ? "Ready" : check.status === "warn" ? "Limited" : "Missing"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {caps ? (
        <div className="tm-capabilities" aria-label="Detected system capabilities">
          <Capability
            label="Platform"
            value={
              caps.platform.raspberryPi
                ? caps.platform.deviceModel ?? "Raspberry Pi"
                : `${caps.platform.arch} · ${caps.platform.os}`
            }
          />
          <Capability
            label="CPU"
            value={`${caps.cpu.vendor ?? "Unknown"} · ${caps.cpu.logicalThreads} threads`}
          />
          <Capability
            label="GPU"
            value={
              caps.gpu.present
                ? `${caps.gpu.vendor ?? "Detected"}${caps.gpu.metrics ? "" : " · no metrics"}`
                : "none detected"
            }
            tone={caps.gpu.present ? "ok" : "muted"}
          />
          <Capability
            label="SMART"
            value={caps.smart.tool ? `${caps.smart.reported}/${caps.smart.devices} devices` : "smartctl missing"}
            tone={caps.smart.tool ? "ok" : "muted"}
          />
          <Capability label="Sensors" value={`${caps.thermal.sensors} temp · ${caps.thermal.fans} fan`} />
          <Capability
            label="WireGuard"
            value={caps.wireguard.present ? "present" : caps.wireguard.tool ? "idle" : "absent"}
            tone={caps.wireguard.present ? "ok" : "muted"}
          />
          <Capability
            label="Tailscale"
            value={caps.tailscale.present ? caps.tailscale.state ?? "present" : "absent"}
            tone={caps.tailscale.present ? "ok" : "muted"}
          />
        </div>
      ) : null}

      <p className="tm-panel-note">
        The dashboard only issues GET requests. It never controls the server, runs shell commands or exposes secrets.
      </p>
    </TelemetryPanel>
  );
}
