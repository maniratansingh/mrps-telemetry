"use client";

import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { useTelemetry } from "@/hooks/useTelemetry";
import { TelemetryHeader } from "@/components/telemetry/TelemetryHeader";
import { TelemetrySectionNav } from "@/components/telemetry/TelemetrySectionNav";
import { TelemetryVitals } from "@/components/telemetry/TelemetryVitals";
import { TelemetryPulse } from "@/components/telemetry/TelemetryPulse";
import { CpuPanel } from "@/components/telemetry/CpuPanel";
import { GpuPanel } from "@/components/telemetry/GpuPanel";
import { MemoryPanel } from "@/components/telemetry/MemoryPanel";
import { ThermalPanel } from "@/components/telemetry/ThermalPanel";
import { NetworkPanel } from "@/components/telemetry/NetworkPanel";
import { StoragePanel } from "@/components/telemetry/StoragePanel";
import { DiskPanel } from "@/components/telemetry/DiskPanel";
import { ProcessesPanel } from "@/components/telemetry/ProcessesPanel";
import { VpnPanel } from "@/components/telemetry/VpnPanel";
import { SystemPanel } from "@/components/telemetry/SystemPanel";
import {
  TelemetryConnectionError,
  TelemetryDataNotice,
  TelemetryLoading,
} from "@/components/telemetry/TelemetryStates";

export function TelemetryDashboard() {
  const telemetry = useTelemetry();
  const {
    host,
    snapshot,
    history,
    health,
    connection,
    lastSuccessAt,
    error,
    initialLoading,
    refreshing,
    apiBase,
    refresh,
    pollIntervalMs,
  } = telemetry;

  const header = (
    <TelemetryHeader
      host={host}
      snapshot={snapshot}
      health={health}
      connection={connection}
      lastSuccessAt={lastSuccessAt}
      error={connection === "live" || !snapshot ? null : error}
      refreshing={refreshing}
      apiBase={apiBase}
      pollIntervalMs={pollIntervalMs}
      onRefresh={refresh}
    />
  );

  if (initialLoading && !snapshot) {
    return (
      <div className="tm-root">
        <div className="tm-shell">
          {header}
          <TelemetryLoading />
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="tm-root">
        <div className="tm-shell">
          {header}
          <TelemetryConnectionError
            error={error}
            apiBase={apiBase}
            lastSuccessAt={lastSuccessAt}
            refreshing={refreshing}
            onRetry={refresh}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="tm-root">
      <div className="tm-shell">
        {header}
        <TelemetrySectionNav />

        <TelemetryDataNotice
          connection={connection}
          lastSuccessAt={lastSuccessAt}
          error={error}
          refreshing={refreshing}
          onRetry={refresh}
        />

        <TelemetryVitals snapshot={snapshot} host={host} />
        <TelemetryPulse history={history} />

        <div className="tm-wall">
          <div className="tm-col-7">
            <CpuPanel host={host} snapshot={snapshot} history={history} />
          </div>
          <div className="tm-col-5">
            <GpuPanel host={host} snapshot={snapshot} history={history} />
          </div>
          <div className="tm-col-4">
            <MemoryPanel snapshot={snapshot} history={history} />
          </div>
          <div className="tm-col-4">
            <ThermalPanel snapshot={snapshot} history={history} />
          </div>
          <div className="tm-col-4">
            <NetworkPanel snapshot={snapshot} history={history} />
          </div>
          <div className="tm-col-7">
            <StoragePanel snapshot={snapshot} />
          </div>
          <div className="tm-col-5">
            <DiskPanel snapshot={snapshot} history={history} />
          </div>
          <div className="tm-col-7">
            <ProcessesPanel snapshot={snapshot} />
          </div>
          <div className="tm-col-5">
            <VpnPanel snapshot={snapshot} />
          </div>
          <div className="tm-col-12">
            <SystemPanel
              host={host}
              snapshot={snapshot}
              health={health}
              apiBase={apiBase}
              pollIntervalMs={pollIntervalMs}
            />
          </div>
        </div>

        <footer className="tm-footer">
          <div className="tm-footer-mark">
            <span className="tm-kicker-dot" aria-hidden="true" />
            <span>MRPS / live telemetry</span>
          </div>
          <p>
            Read-only telemetry from the existing Ubuntu server. No mock readings, no control actions.
          </p>
          <a href="https://mrps.in" className="tm-footer-link" target="_blank" rel="noreferrer">
            <span>Return to mrps.in</span>
            <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
          </a>
          <span className="tm-footer-note">
            <ShieldCheck size={13} strokeWidth={1.8} aria-hidden="true" /> GET-only · public endpoint · 120-sample API history
          </span>
        </footer>
      </div>
    </div>
  );
}
