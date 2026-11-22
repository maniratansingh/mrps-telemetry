"use client";

import * as React from "react";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";
import type { CpuProcess, Snapshot } from "@/lib/telemetry/types";
import { formatBytes, formatNumber, formatPercent } from "@/lib/telemetry/format";
import { TelemetryPanel } from "@/components/telemetry/TelemetryPanel";
import { EmptyState } from "@/components/telemetry/TelemetryBits";

type SortKey = "cpuPercent" | "memoryBytes" | "name" | "pid";
type SortDirection = "asc" | "desc";

interface ProcessesPanelProps {
  snapshot: Snapshot;
}

export function ProcessesPanel({ snapshot }: ProcessesPanelProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>("cpuPercent");
  const [direction, setDirection] = React.useState<SortDirection>("desc");
  const processes = snapshot.processes.cpu;
  const totalMemory = snapshot.memory.totalBytes || 1;

  const sorted = React.useMemo(() => {
    return [...processes].sort((a, b) => {
      const multiplier = direction === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * multiplier;
      return ((a[sortKey] as number) - (b[sortKey] as number)) * multiplier;
    });
  }, [processes, sortKey, direction]);

  const changeSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDirection(key === "name" ? "asc" : "desc");
  };

  const SortHeader = ({
    column,
    children,
    align = "left",
  }: {
    column: SortKey;
    children: React.ReactNode;
    align?: "left" | "right";
  }) => {
    const active = sortKey === column;
    return (
      <th
        scope="col"
        aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
        className={align === "right" ? "tm-align-right" : undefined}
      >
        <button type="button" className="tm-sort-button" onClick={() => changeSort(column)}>
          <span>{children}</span>
          {active ? (
            direction === "asc" ? (
              <ChevronUp size={11} strokeWidth={2} aria-hidden="true" />
            ) : (
              <ChevronDown size={11} strokeWidth={2} aria-hidden="true" />
            )
          ) : null}
        </button>
      </th>
    );
  };

  return (
    <TelemetryPanel
      id="processes"
      index="08"
      title="Processes"
      subtitle="Top CPU consumers returned by the backend"
      meta={
        <span className="tm-panel-current tm-mono">
          {formatNumber(snapshot.cpu.processCount)}
          <small>total</small>
        </span>
      }
    >
      <div className="tm-panel-toolbar">
        <span>
          <Activity size={13} strokeWidth={1.8} aria-hidden="true" /> Sortable · read-only
        </span>
        <span>{sorted.length} processes in this response</span>
      </div>

      {sorted.length > 0 ? (
        <div className="tm-table-shell">
          <table className="tm-table tm-process-table">
            <thead>
              <tr>
                <SortHeader column="name">Process</SortHeader>
                <SortHeader column="pid" align="right">PID</SortHeader>
                <SortHeader column="cpuPercent" align="right">CPU</SortHeader>
                <SortHeader column="memoryBytes" align="right">RSS</SortHeader>
                <th scope="col" className="tm-align-right">Memory %</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((process: CpuProcess) => (
                <tr key={`${process.pid}-${process.name}`}>
                  <th scope="row">
                    <span className="tm-process-name">{process.name}</span>
                    <small>No command line available</small>
                  </th>
                  <td className="tm-align-right tm-mono">{process.pid}</td>
                  <td className="tm-align-right tm-mono">{formatPercent(process.cpuPercent)}</td>
                  <td className="tm-align-right tm-mono">{formatBytes(process.memoryBytes)}</td>
                  <td className="tm-align-right tm-mono">
                    {formatPercent((process.memoryBytes / totalMemory) * 100, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Activity}
          title="No processes returned"
          description="The API returned an empty CPU process list."
        />
      )}

      <div className="tm-subsection">
        <div className="tm-subsection-head">
          <div>
            <span className="tm-kicker">GPU processes</span>
            <h3>{snapshot.processes.gpu.length} reported</h3>
          </div>
        </div>
        {snapshot.processes.gpu.length > 0 ? (
          <div className="tm-mini-list">
            {snapshot.processes.gpu.map((process) => (
              <div className="tm-mini-row" key={`${process.pid}-${process.name}`}>
                <span className="tm-mono">{process.pid}</span>
                <span>{process.name}</span>
                <span className="tm-mono">
                  {process.vramBytes === undefined ? "—" : formatBytes(process.vramBytes)}
                </span>
                <span className="tm-mono">
                  {process.usagePercent === null || process.usagePercent === undefined
                    ? "—"
                    : formatPercent(process.usagePercent)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="tm-inline-note">No active GPU processes were returned by nvidia-smi.</p>
        )}
      </div>

      <p className="tm-panel-note">
        Process names and values are exactly what the API reported. Command lines and control actions are not available.
      </p>
    </TelemetryPanel>
  );
}
