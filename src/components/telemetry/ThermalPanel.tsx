import { Fan, Thermometer } from "lucide-react";
import type { HistoryPoint, Snapshot, ThermalSensor } from "@/lib/telemetry/types";
import { historyTimestamps, historyValues } from "@/lib/telemetry/history";
import { hottestSensor } from "@/lib/telemetry/derive";
import { formatTemp } from "@/lib/telemetry/format";
import { TelemetryPanel } from "@/components/telemetry/TelemetryPanel";
import { TelemetryChart } from "@/components/telemetry/TelemetryChart";
import { EmptyState } from "@/components/telemetry/TelemetryBits";

interface ThermalPanelProps {
  snapshot: Snapshot;
  history: HistoryPoint[];
}

const ZONE_LABEL: Record<ThermalSensor["zone"], string> = {
  cpu: "Processor",
  gpu: "Graphics",
  board: "Board",
  storage: "Storage",
  other: "Other",
};

function groupSensors(sensors: ThermalSensor[]): Array<[ThermalSensor["zone"], ThermalSensor[]]> {
  const groups = new Map<ThermalSensor["zone"], ThermalSensor[]>();
  for (const sensor of sensors) {
    const existing = groups.get(sensor.zone) ?? [];
    existing.push(sensor);
    groups.set(sensor.zone, existing);
  }
  return Array.from(groups.entries());
}

export function ThermalPanel({ snapshot, history }: ThermalPanelProps) {
  const timestamps = historyTimestamps(history);
  const cpuTemp = historyValues(history, "cpuTemp");
  const gpuTemp = historyValues(history, "gpuTemp");
  const hottest = hottestSensor(snapshot.thermal.sensors);
  const groups = groupSensors(snapshot.thermal.sensors);

  return (
    <TelemetryPanel
      id="thermal"
      index="06"
      title="Thermal"
      subtitle="Every temperature sensor returned by the host"
      meta={
        <span className="tm-panel-current tm-mono">
          {formatTemp(hottest?.valueC)}
          <small>hottest</small>
        </span>
      }
    >
      <div className="tm-chart-block tm-chart-block-compact">
        <div className="tm-chart-caption">
          <span>
            <Thermometer size={13} strokeWidth={1.8} aria-hidden="true" /> Temperature history
          </span>
          <span>CPU / GPU · API history</span>
        </div>
        <TelemetryChart
          series={[
            { id: "cpu-temp", label: "CPU package", color: "var(--tm-cpu)", values: cpuTemp },
            { id: "gpu-temp", label: "GPU", color: "var(--tm-gpu)", values: gpuTemp },
          ]}
          timestamps={timestamps}
          height={138}
          min={20}
          unit="°C"
          showLegend
          valueFormatter={(value) => formatTemp(value)}
          axisFormatter={(value) => `${Math.round(value)}°`}
          ariaLabel="CPU and GPU temperature history"
        />
      </div>

      {groups.length > 0 ? (
        <div className="tm-sensor-groups">
          {groups.map(([zone, sensors]) => (
            <div className="tm-sensor-group" key={zone}>
              <span className="tm-sensor-zone">{ZONE_LABEL[zone]}</span>
              {sensors.map((sensor) => (
                <div className="tm-sensor-row" key={sensor.id}>
                  <span className="tm-sensor-name">{sensor.label}</span>
                  <span className="tm-sensor-source tm-mono">{sensor.source ?? "sensor"}</span>
                  <strong className="tm-mono">{formatTemp(sensor.valueC)}</strong>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Thermometer}
          title="No thermal sensors reported"
          description="The snapshot did not include any sensor readings."
        />
      )}

      <div className="tm-fans">
        <div className="tm-subsection-head">
          <div>
            <span className="tm-kicker">Fans</span>
            <h3>{snapshot.thermal.fans.length} channels</h3>
          </div>
        </div>
        {snapshot.thermal.fans.length > 0 ? (
          <div className="tm-fan-list">
            {snapshot.thermal.fans.map((fan) => (
              <div className="tm-fan-row" key={fan.id}>
                <span>
                  <Fan size={13} strokeWidth={1.8} aria-hidden="true" /> {fan.label}
                </span>
                <strong className="tm-mono">
                  {fan.rpm === null || fan.rpm === undefined ? "—" : `${fan.rpm.toLocaleString("en-IN")} RPM`}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="tm-inline-note">No fan channels were reported by the backend.</p>
        )}
      </div>

      <p className="tm-panel-note">
        The API does not expose warning or critical thresholds; readings are displayed without inferred severity.
      </p>
    </TelemetryPanel>
  );
}
