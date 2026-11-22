"use client";

import { RefreshCw, ShieldCheck } from "lucide-react";
import type { ApiHealth, ConnectionState, HostInfo, Snapshot } from "@/lib/telemetry/types";
import { connectionLabel } from "@/lib/telemetry/derive";
import { formatClock, formatRelativeTime, formatTimestamp, formatUptime, readableApiHost } from "@/lib/telemetry/format";
import { useNow } from "@/hooks/useNow";
import { StatusBadge } from "@/components/telemetry/TelemetryBits";

interface TelemetryHeaderProps {
  host: HostInfo | null;
  snapshot: Snapshot | null;
  health: ApiHealth | null;
  connection: ConnectionState;
  lastSuccessAt: number | null;
  error: string | null;
  refreshing: boolean;
  apiBase: string;
  pollIntervalMs: number;
  onRefresh: () => void;
}

export function TelemetryHeader({
  host,
  snapshot,
  health,
  connection,
  lastSuccessAt,
  error,
  refreshing,
  apiBase,
  pollIntervalMs,
  onRefresh,
}: TelemetryHeaderProps) {
  const now = useNow(1_000);
  const system = snapshot?.system;
  const hostname = system?.hostname ?? host?.hostname ?? "Waiting for host";
  const os = system?.os ?? (host ? `${host.os} ${host.osVersion}` : "—");
  const kernel = system?.kernel ?? host?.kernel ?? "—";
  const uptime = system?.uptimeSeconds;

  return (
    <header id="overview" className="tm-hero tm-anchor">
      <div className="tm-hero-top">
        <div className="tm-hero-copy">
          <div className="tm-kicker">
            <span className="tm-kicker-dot" aria-hidden="true" />
            <span>Live telemetry</span>
            <span className="tm-kicker-separator" aria-hidden="true">
              /
            </span>
            <span>Node 01</span>
          </div>

          <h1 className="tm-hero-title">
            Machine
            <br />
            <span>Telemetry</span>
          </h1>

          <p className="tm-hero-subtitle">
            {hostname === "Waiting for host" ? (
              "Connecting to the telemetry source."
            ) : (
              <>
                A live reading of <span>{hostname}</span>, observed directly from the server.
              </>
            )}
          </p>

          <div className="tm-hero-meta">
            <span className="tm-hero-meta-item">
              <span className="tm-meta-label">Host</span>
              <span className="tm-mono">{hostname}</span>
            </span>
            <span className="tm-hero-meta-item">
              <span className="tm-meta-label">System</span>
              <span>{os}</span>
            </span>
            <span className="tm-hero-meta-item">
              <span className="tm-meta-label">Kernel</span>
              <span className="tm-mono">{kernel}</span>
            </span>
            <span className="tm-hero-meta-item">
              <span className="tm-meta-label">Uptime</span>
              <span className="tm-mono">{formatUptime(uptime)}</span>
            </span>
          </div>
        </div>

        <div className="tm-hero-status">
          <div className="tm-hero-status-top">
            <StatusBadge
              state={connection}
              label={connectionLabel(connection)}
              pulse={connection === "live"}
            />
            <button
              type="button"
              className={`tm-refresh ${refreshing ? "is-refreshing" : ""}`}
              onClick={onRefresh}
              aria-label="Refresh telemetry now"
              title="Refresh telemetry now"
            >
              <RefreshCw size={15} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>

          <div className="tm-hero-status-facts">
            <div>
              <span>Last sample</span>
              <strong className="tm-mono">
                {snapshot ? formatClock(snapshot.timestamp, system?.timezone) : "—"}
              </strong>
            </div>
            <div>
              <span>Last successful</span>
              <strong>{formatRelativeTime(lastSuccessAt, now)}</strong>
            </div>
            <div>
              <span>Polling</span>
              <strong className="tm-mono">
                {pollIntervalMs % 1000 === 0 ? `${pollIntervalMs / 1000} s` : `${pollIntervalMs} ms`}
              </strong>
            </div>
            <div>
              <span>API</span>
              <strong className="tm-mono">
                {health?.status ??
                  (error ? "unreachable" : connection === "live" ? "ok" : "checking")}
              </strong>
            </div>
          </div>

          <div className="tm-hero-source">
            <ShieldCheck size={13} strokeWidth={1.8} aria-hidden="true" />
            <span>
              Read-only · <span className="tm-mono">{readableApiHost(apiBase)}</span>
            </span>
          </div>

          {error ? (
            <p className="tm-hero-error" role="status">
              {error}
            </p>
          ) : (
            <p className="tm-hero-sample-note">
              Source timestamp: <span className="tm-mono">{snapshot ? formatTimestamp(snapshot.timestamp, system?.timezone) : "awaiting first sample"}</span>
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
