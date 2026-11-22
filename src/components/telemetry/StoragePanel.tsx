import { HardDrive, ShieldCheck } from "lucide-react";
import type { Snapshot } from "@/lib/telemetry/types";
import type { SmartDevice } from "@/lib/telemetry/types";
import {
  hasAtaSmart,
  hasNvmeSmart,
  percentUsed,
  smartByDevice,
  storageKindLabel,
  storageSummary,
} from "@/lib/telemetry/derive";
import {
  formatBytes,
  formatNumber,
  formatPercent,
  formatSmartValue,
  formatTemp,
} from "@/lib/telemetry/format";
import { TelemetryPanel } from "@/components/telemetry/TelemetryPanel";
import { RadialGauge, Stat } from "@/components/telemetry/TelemetryBits";

interface StoragePanelProps {
  snapshot: Snapshot;
}

function SmartDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="tm-smart-row">
      <span>{label}</span>
      <strong className="tm-mono">{value}</strong>
    </div>
  );
}

function SmartFields({ device }: { device: SmartDevice | undefined }) {
  if (!device) {
    return <p className="tm-inline-note">SMART data was not returned for this device.</p>;
  }

  return (
    <div className="tm-smart-grid">
      <SmartDetailRow label="Reported health" value={formatSmartValue(device.health)} />
      <SmartDetailRow label="Temperature" value={formatTemp(device.temperatureC)} />
      <SmartDetailRow
        label="Power-on hours"
        value={device.powerOnHours === null ? "Not reported" : formatNumber(device.powerOnHours)}
      />
      {hasAtaSmart(device) ? (
        <>
          <SmartDetailRow label="Reallocated sectors" value={formatSmartValue(device.reallocatedSectors)} />
          <SmartDetailRow label="Pending sectors" value={formatSmartValue(device.pendingSectors)} />
          <SmartDetailRow label="Offline uncorrectable" value={formatSmartValue(device.offlineUncorrectable)} />
          <SmartDetailRow label="UDMA CRC errors" value={formatSmartValue(device.udmaCrcErrors)} />
        </>
      ) : null}
      {hasNvmeSmart(device) ? (
        <>
          <SmartDetailRow
            label="Percentage used"
            value={device.nvmePercentageUsed === null ? "Not reported" : `${formatNumber(device.nvmePercentageUsed)}%`}
          />
          <SmartDetailRow
            label="Available spare"
            value={
              device.nvmeAvailableSparePercent === null
                ? "Not reported"
                : `${formatNumber(device.nvmeAvailableSparePercent)}%`
            }
          />
          <SmartDetailRow label="Critical warning" value={formatSmartValue(device.nvmeCriticalWarning)} />
          <SmartDetailRow
            label="Media/data errors"
            value={formatSmartValue(device.nvmeMediaDataIntegrityErrors)}
          />
          <SmartDetailRow
            label="Error log entries"
            value={formatSmartValue(device.nvmeErrorInformationLogEntries)}
          />
        </>
      ) : null}
    </div>
  );
}

export function StoragePanel({ snapshot }: StoragePanelProps) {
  const devices = snapshot.storage.devices;
  const summary = storageSummary(devices);
  const smartMap = smartByDevice(snapshot.smart);

  return (
    <TelemetryPanel
      id="storage"
      index="07"
      title="Storage"
      subtitle="Detected block devices, mounts and SMART inventory"
      meta={
        <span className="tm-panel-current tm-mono">
          {formatPercent(summary.percent)}
          <small>used</small>
        </span>
      }
    >
      <div className="tm-stat-row tm-stat-row-three">
        <Stat label="Detected capacity" value={formatBytes(summary.capacityBytes)} hint={`${devices.length} devices`} />
        <Stat label="Used in mounted filesystems" value={formatBytes(summary.usedBytes)} />
        <Stat label="Free capacity" value={formatBytes(summary.freeBytes)} />
      </div>

      <div className="tm-storage-grid">
        {devices.map((device) => {
          const smart = smartMap.get(device.id);
          const mounted = device.volumes.length > 0;
          const usage = mounted ? percentUsed(device.usedBytes, device.capacityBytes) : null;
          const healthUnavailable = device.smartStatus === "unavailable";
          return (
            <article className="tm-storage-card" key={device.id}>
              <div className="tm-storage-head">
                <span className="tm-storage-icon" aria-hidden="true">
                  <HardDrive size={15} strokeWidth={1.7} />
                </span>
                <div>
                  <h3>{device.label}</h3>
                  <p>
                    {device.model} <span>·</span> {storageKindLabel(device.kind)}
                  </p>
                </div>
                <span className={`tm-smart-pill ${healthUnavailable ? "tm-smart-unavailable" : ""}`}>
                  {healthUnavailable ? "SMART unsupported" : smart?.health ?? device.smartStatus}
                </span>
              </div>

              <div className="tm-storage-capacity">
                <div>
                  <strong className="tm-mono">{mounted ? formatBytes(device.usedBytes) : "—"}</strong>
                  <span>{mounted ? `used of ${formatBytes(device.capacityBytes)}` : `not mounted · ${formatBytes(device.capacityBytes)}`}</span>
                </div>
                <RadialGauge
                  value={usage}
                  size={40}
                  color="var(--tm-storage)"
                  label={`${device.label} used`}
                />
              </div>

              <div className="tm-storage-meta">
                <span>{formatTemp(device.temperatureC)}</span>
                {mounted ? (
                  <span>{formatBytes(Math.max(0, device.capacityBytes - device.usedBytes))} free</span>
                ) : null}
                <span>{device.volumes.length} mounted volume{device.volumes.length === 1 ? "" : "s"}</span>
                {device.healthPercent !== null ? <span>{device.healthPercent}% health</span> : null}
              </div>

              {device.volumes.length > 0 ? (
                <div className="tm-volume-list">
                  {device.volumes.map((volume) => (
                    <div key={`${device.id}-${volume.mount}`}>
                      <span className="tm-mono">{volume.mount}</span>
                      <span className="tm-mono">
                        {formatBytes(volume.usedBytes)} / {formatBytes(volume.totalBytes)} · {volume.fstype}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {healthUnavailable ? (
                <p className="tm-smart-note">
                  SMART is not exposed by this device&apos;s USB bridge. Capacity, mounts and I/O
                  remain live; no SMART values are inferred.
                </p>
              ) : null}

              {smart && !healthUnavailable ? (
                <p className="tm-smart-summary">
                  {hasNvmeSmart(smart)
                    ? `Reported ${smart.powerOnHours === null ? "—" : `${formatNumber(smart.powerOnHours)} h`} · used ${
                        smart.nvmePercentageUsed === null ? "—" : `${formatNumber(smart.nvmePercentageUsed)}%`
                      } · spare ${
                        smart.nvmeAvailableSparePercent === null
                          ? "—"
                          : `${formatNumber(smart.nvmeAvailableSparePercent)}%`
                      } · errors ${
                        smart.nvmeErrorInformationLogEntries === null
                          ? "—"
                          : formatNumber(smart.nvmeErrorInformationLogEntries)
                      }`
                    : `Reported ${smart.powerOnHours === null ? "—" : `${formatNumber(smart.powerOnHours)} h`} · realloc ${
                        smart.reallocatedSectors === null ? "—" : formatNumber(smart.reallocatedSectors)
                      } · pending ${smart.pendingSectors === null ? "—" : formatNumber(smart.pendingSectors)} · CRC ${
                        smart.udmaCrcErrors === null ? "—" : formatNumber(smart.udmaCrcErrors)
                      }`}
                </p>
              ) : null}

              {!healthUnavailable ? (
                <details className="tm-smart-details">
                  <summary>
                    <span>
                      <ShieldCheck size={13} strokeWidth={1.8} aria-hidden="true" /> SMART detail
                    </span>
                    <span className="tm-mono">{soundSmartLabel(device.smartStatus)}</span>
                  </summary>
                  <SmartFields device={smart} />
                </details>
              ) : null}
            </article>
          );
        })}
      </div>

      <p className="tm-panel-note">
        SMART fields are displayed exactly as returned by the API. Usage is only shown for mounted
        filesystems; the API reports 0 B for unmounted devices, which are labelled as not mounted.
      </p>
    </TelemetryPanel>
  );
}

function soundSmartLabel(status: string): string {
  if (status === "passed") return "PASSED";
  if (status === "warning") return "WARNING";
  return "UNAVAILABLE";
}
