"use client";

import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import type { ConnectionState } from "@/lib/telemetry/types";
import { formatRelativeTime, readableApiHost } from "@/lib/telemetry/format";
import { useNow } from "@/hooks/useNow";

export function TelemetryLoading() {
  return (
    <div className="tm-loading" aria-busy="true" aria-label="Loading telemetry">
      <div className="tm-skeleton tm-skeleton-vitals">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="tm-skeleton-card" key={index}>
            <span className="tm-skeleton-line tm-skeleton-line-short" />
            <span className="tm-skeleton-number" />
            <span className="tm-skeleton-line" />
          </div>
        ))}
      </div>
      <div className="tm-skeleton tm-skeleton-pulse" />
      <div className="tm-skeleton tm-skeleton-grid">
        <div className="tm-skeleton-card tm-skeleton-tall" />
        <div className="tm-skeleton-card tm-skeleton-tall" />
        <div className="tm-skeleton-card" />
        <div className="tm-skeleton-card" />
        <div className="tm-skeleton-card" />
      </div>
      <span className="sr-only">Connecting to the telemetry API…</span>
    </div>
  );
}

export function TelemetryConnectionError({
  error,
  apiBase,
  lastSuccessAt,
  refreshing,
  onRetry,
}: {
  error: string | null;
  apiBase: string;
  lastSuccessAt: number | null;
  refreshing: boolean;
  onRetry: () => void;
}) {
  const now = useNow(1_000);

  return (
    <section className="tm-error-panel" role="alert" aria-labelledby="telemetry-error-title">
      <span className="tm-error-icon" aria-hidden="true">
        <WifiOff size={20} strokeWidth={1.6} />
      </span>
      <div className="tm-error-copy">
        <span className="tm-kicker">Connection error</span>
        <h2 id="telemetry-error-title">The telemetry link is unavailable.</h2>
        <p>
          {error ??
            "The dashboard could not reach the telemetry API. No values are being fabricated while the connection is down."}
        </p>
        <div className="tm-error-meta">
          <span>
            API <span className="tm-mono">{readableApiHost(apiBase)}</span>
          </span>
          <span>Last successful sample: {formatRelativeTime(lastSuccessAt, now)}</span>
        </div>
        <p className="tm-error-hint">
          If this website is open over HTTPS, the browser will block a direct HTTP API request. Open the dashboard through
          the site&apos;s HTTP/local address while the telemetry endpoint is served over HTTP.
        </p>
        <button type="button" className="tm-button" onClick={onRetry} disabled={refreshing}>
          <RefreshCw size={14} strokeWidth={1.9} aria-hidden="true" className={refreshing ? "tm-spin" : ""} />
          {refreshing ? "Retrying…" : "Retry connection"}
        </button>
      </div>
    </section>
  );
}

export function TelemetryDataNotice({
  connection,
  lastSuccessAt,
  error,
  refreshing,
  onRetry,
}: {
  connection: ConnectionState;
  lastSuccessAt: number | null;
  error: string | null;
  refreshing: boolean;
  onRetry: () => void;
}) {
  const now = useNow(1_000);
  if (connection === "live" || connection === "connecting") return null;

  const title =
    connection === "offline"
      ? "The server reports that it is offline."
      : connection === "stale"
        ? "The telemetry sample is delayed."
        : "The telemetry API is unreachable.";

  return (
    <div className={`tm-data-notice tm-notice-${connection}`} role="status">
      <AlertTriangle size={16} strokeWidth={1.8} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>
          Showing the last successful sample from {formatRelativeTime(lastSuccessAt, now)}.
          {error ? ` ${error}` : " The dashboard will retry automatically."}
        </p>
      </div>
      <button type="button" className="tm-text-button" onClick={onRetry} disabled={refreshing}>
        {refreshing ? "Retrying…" : "Retry now"}
      </button>
    </div>
  );
}
