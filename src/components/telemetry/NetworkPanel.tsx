"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, Network } from "lucide-react";
import type { HistoryPoint, Snapshot } from "@/lib/telemetry/types";
import { historyTimestamps, historyValues, seriesPeak } from "@/lib/telemetry/history";
import { formatNetworkAxis, visibleNetworkInterfaces } from "@/lib/telemetry/derive";
import { formatBitRate, formatBytes, formatNumber } from "@/lib/telemetry/format";
import { TelemetryPanel } from "@/components/telemetry/TelemetryPanel";
import { TelemetryChart } from "@/components/telemetry/TelemetryChart";
import { Stat } from "@/components/telemetry/TelemetryBits";

interface NetworkPanelProps {
  snapshot: Snapshot;
  history: HistoryPoint[];
}

export function NetworkPanel({ snapshot, history }: NetworkPanelProps) {
  const [showTable, setShowTable] = React.useState(false);
  const timestamps = historyTimestamps(history);
  const rxHistory = historyValues(history, "rx");
  const txHistory = historyValues(history, "tx");
  const network = snapshot.network;
  const primaryInterfaces = visibleNetworkInterfaces(network.interfaces, false);
  const interfaces = visibleNetworkInterfaces(network.interfaces, true);
  const hasPacketCounters = network.interfaces.some(
    (entry) => entry.rxPackets !== undefined || entry.txPackets !== undefined,
  );
  const errors = network.interfaces.reduce((total, entry) => total + (entry.errors || 0), 0);
  const drops = network.interfaces.reduce((total, entry) => total + (entry.drops || 0), 0);

  return (
    <TelemetryPanel
      id="network"
      index="04"
      title="Network"
      subtitle="Aggregate throughput and interface counters"
      meta={
        <span className="tm-network-rates">
          <span>
            <ArrowDownLeft size={12} strokeWidth={1.9} aria-hidden="true" />
            {formatBitRate(network.rxBytesPerSecond)}
          </span>
          <span>
            <ArrowUpRight size={12} strokeWidth={1.9} aria-hidden="true" />
            {formatBitRate(network.txBytesPerSecond)}
          </span>
        </span>
      }
    >
      <div className="tm-chart-block tm-chart-block-compact">
        <div className="tm-chart-caption">
          <span>
            <Network size={13} strokeWidth={1.8} aria-hidden="true" /> Throughput history
          </span>
          <span>Bits/s · API history</span>
        </div>
        <TelemetryChart
          series={[
            { id: "rx", label: "Received", color: "var(--tm-network)", values: rxHistory },
            { id: "tx", label: "Transmitted", color: "var(--tm-network-soft)", values: txHistory },
          ]}
          timestamps={timestamps}
          height={150}
          min={0}
          showLegend
          valueFormatter={(value) => formatBitRate(value)}
          axisFormatter={formatNetworkAxis}
          ariaLabel="Aggregate network throughput history"
        />
      </div>

      <div className="tm-stat-row">
        <Stat label="Peak receive" value={formatBitRate(seriesPeak(rxHistory))} hint="in view" />
        <Stat label="Peak transmit" value={formatBitRate(seriesPeak(txHistory))} hint="in view" />
        <Stat label="Received total" value={formatBytes(network.rxTotalBytes, 0)} />
        <Stat label="Transmitted total" value={formatBytes(network.txTotalBytes, 0)} />
      </div>

      <div className="tm-subsection">
        <div className="tm-subsection-head">
          <div>
            <span className="tm-kicker">Interfaces</span>
            <h3>{network.interfaces.length} detected</h3>
          </div>
          <button
            type="button"
            className="tm-text-button"
            onClick={() => setShowTable((value) => !value)}
            aria-expanded={showTable}
          >
            {showTable ? "Hide interfaces" : `Show all ${network.interfaces.length}`}
          </button>
        </div>

        {showTable ? (
        <div className="tm-table-shell" tabIndex={0} role="region" aria-label="Network interfaces">
          {interfaces.length > 0 ? (
            <table className="tm-table tm-network-table">
              <thead>
                <tr>
                  <th scope="col">Interface</th>
                  <th scope="col">State</th>
                  <th scope="col">Address</th>
                  <th scope="col" className="tm-align-right">RX</th>
                  <th scope="col" className="tm-align-right">TX</th>
                  <th scope="col" className="tm-align-right">Errors</th>
                  <th scope="col" className="tm-align-right">Drops</th>
                </tr>
              </thead>
              <tbody>
                {interfaces.map((entry) => (
                  <tr key={entry.name} className={entry.state === "down" ? "tm-row-muted" : undefined}>
                    <th scope="row">
                      <span className="tm-mono">{entry.name}</span>
                      <small>{entry.kind}</small>
                    </th>
                    <td>
                      <span className={`tm-state-pill tm-state-${entry.state}`}>{entry.state}</span>
                    </td>
                    <td className="tm-mono">{entry.ipv4 ?? "—"}</td>
                    <td className="tm-align-right tm-mono">{formatBitRate(entry.rxBytesPerSecond)}</td>
                    <td className="tm-align-right tm-mono">{formatBitRate(entry.txBytesPerSecond)}</td>
                    <td className="tm-align-right tm-mono">{formatNumber(entry.errors)}</td>
                    <td className="tm-align-right tm-mono">{formatNumber(entry.drops)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="tm-inline-note">No network interfaces were returned by the API.</p>
          )}
        </div>
        ) : (
          <div className="tm-interface-summary">
            {primaryInterfaces.map((entry) => (
              <span key={entry.name} className={entry.state === "down" ? "tm-summary-down" : undefined}>
                <i aria-hidden="true" />
                <b className="tm-mono">{entry.name}</b>
                <em>{entry.state}</em>
                <em className="tm-mono">↓ {formatBitRate(entry.rxBytesPerSecond)}</em>
              </span>
            ))}
          </div>
        )}

        <div className="tm-inline-meta">
          <span>{formatNumber(errors)} errors</span>
          <span>{formatNumber(drops)} dropped</span>
          <span>{hasPacketCounters ? "packet counters reported" : "packet counters not exposed by this API"}</span>
        </div>
      </div>

      <p className="tm-panel-note">
        Throughput is calculated by the telemetry API from successive interface counters. Values are not estimated by the UI.
      </p>
    </TelemetryPanel>
  );
}
