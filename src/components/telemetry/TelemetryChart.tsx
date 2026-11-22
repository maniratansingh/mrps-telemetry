"use client";

import * as React from "react";
import { useElementSize } from "@/hooks/useElementSize";
import {
  areaPath,
  chartPeak,
  formatAxisValue,
  linePath,
  niceScale,
  type ChartPoint,
} from "@/lib/telemetry/chart";
import { formatClock } from "@/lib/telemetry/format";

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  values: Array<number | null>;
  area?: boolean;
  dashed?: boolean;
}

interface TelemetryChartProps {
  series: ChartSeries[];
  timestamps: number[];
  height?: number;
  min?: number;
  max?: number | "auto";
  unit?: string;
  valueFormatter?: (value: number) => string;
  axisFormatter?: (value: number) => string;
  showLegend?: boolean;
  ariaLabel?: string;
  timeZone?: string;
  className?: string;
}

const PAD = { top: 14, right: 12, bottom: 28, left: 44 };

function buildSegments(
  points: Array<ChartPoint | null>,
): Array<{ startIndex: number; points: ChartPoint[] }> {
  const segments: Array<{ startIndex: number; points: ChartPoint[] }> = [];
  let current: ChartPoint[] = [];
  let startIndex = 0;

  points.forEach((point, index) => {
    if (point) {
      if (current.length === 0) startIndex = index;
      current.push(point);
    } else if (current.length > 0) {
      segments.push({ startIndex, points: current });
      current = [];
    }
  });

  if (current.length > 0) segments.push({ startIndex, points: current });
  return segments;
}

export function TelemetryChart({
  series,
  timestamps,
  height: heightProp = 220,
  min = 0,
  max = "auto",
  unit,
  valueFormatter,
  axisFormatter,
  showLegend = false,
  ariaLabel,
  timeZone = "Asia/Kolkata",
  className = "",
}: TelemetryChartProps) {
  const [ref, width] = useElementSize<HTMLDivElement>();
  const [largeDisplay, setLargeDisplay] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 2000px)");
    const update = () => setLargeDisplay(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const height = largeDisplay ? Math.round(heightProp * 1.15) : heightProp;
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const gradientId = React.useId().replace(/:/g, "");
  const count = timestamps.length;
  const lastTimestamp = count > 0 ? timestamps[count - 1] : 0;
  const firstTimestamp = count > 0 ? timestamps[0] : 0;
  const timeRange = Math.max(1, lastTimestamp - firstTimestamp);

  const allValues = series.flatMap((entry) => entry.values).filter((value): value is number => value !== null && Number.isFinite(value));
  const peak = chartPeak(allValues);
  const scaleMax =
    typeof max === "number"
      ? max
      : Math.max(min + (unit === "%" ? 5 : 1), peak * 1.15);
  const scale = niceScale(scaleMax, 4, min, typeof max === "number" ? max : undefined);

  const plotWidth = Math.max(1, width - PAD.left - PAD.right);
  const plotHeight = Math.max(1, height - PAD.top - PAD.bottom);

  const xForTimestamp = (timestamp: number) =>
    PAD.left + ((timestamp - firstTimestamp) / timeRange) * plotWidth;
  const yForValue = (value: number) =>
    PAD.top + (1 - (Math.min(scale.max, Math.max(scale.min, value)) - scale.min) / (scale.max - scale.min || 1)) * plotHeight;

  const format = valueFormatter ?? ((value: number) => `${value.toFixed(value >= 100 ? 0 : 1)}${unit ?? ""}`);
  const formatAxis = axisFormatter ?? ((value: number) => formatAxisValue(value, unit));

  const seriesPaths = series.map((entry) => {
    const points: Array<ChartPoint | null> = Array.from({ length: count }, (_, index) => {
      const value = entry.values[index];
      if (value === null || value === undefined || !Number.isFinite(value)) return null;
      return {
        x: xForTimestamp(timestamps[index]),
        y: yForValue(value),
      };
    });
    return { ...entry, segments: buildSegments(points) };
  });

  const hasData = seriesPaths.some((entry) => entry.segments.length > 0) && count > 1;
  const tickCount = width < 560 ? 3 : 4;
  const tickIndices =
    tickCount === 3
      ? [0, Math.round((count - 1) / 2), count - 1]
      : [0, Math.round((count - 1) / 3), Math.round(((count - 1) * 2) / 3), count - 1];

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!hasData || count < 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(width - PAD.right, Math.max(PAD.left, event.clientX - rect.left));
    const targetTime = firstTimestamp + ((x - PAD.left) / plotWidth) * timeRange;
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < count; index += 1) {
      const currentDistance = Math.abs(timestamps[index] - targetTime);
      if (currentDistance < distance) {
        distance = currentDistance;
        nearest = index;
      }
      if (timestamps[index] > targetTime) break;
    }
    setHoverIndex(nearest);
  };

  const hoverX = hoverIndex !== null ? xForTimestamp(timestamps[hoverIndex]) : 0;
  const tooltipLeft = Math.min(Math.max(hoverX, 90), Math.max(90, width - 90));

  return (
    <div className={`tm-chart ${className}`.trim()} ref={ref}>
      {showLegend ? (
        <div className="tm-chart-legend">
          {series.map((entry) => {
            const current = [...entry.values]
              .reverse()
              .find((value): value is number => value !== null && Number.isFinite(value));
            return (
              <span className="tm-chart-legend-item" key={entry.id}>
                <i style={{ background: entry.color }} aria-hidden="true" />
                <span>{entry.label}</span>
                <strong>{current !== undefined ? format(current) : "—"}</strong>
              </span>
            );
          })}
        </div>
      ) : null}

      {width > 0 && count > 1 ? (
        <div className="tm-chart-canvas" style={{ height }}>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={
              ariaLabel ??
              series
                .map((entry) => {
                  const current = [...entry.values]
                    .reverse()
                    .find((value): value is number => value !== null && Number.isFinite(value));
                  return `${entry.label}: ${current !== undefined ? format(current) : "unavailable"}`;
                })
                .join(", ")
            }
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          >
            <defs>
              {series.map((entry, index) => (
                <linearGradient key={entry.id} id={`tm-area-${gradientId}-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={entry.color} stopOpacity="0.24" />
                  <stop offset="70%" stopColor={entry.color} stopOpacity="0.04" />
                  <stop offset="100%" stopColor={entry.color} stopOpacity="0" />
                </linearGradient>
              ))}
              <clipPath id={`tm-clip-${gradientId}`}>
                <rect x={PAD.left} y={PAD.top - 6} width={plotWidth} height={plotHeight + 6} rx="2" />
              </clipPath>
            </defs>

            {scale.ticks.map((tick) => {
              const y = yForValue(tick);
              return (
                <g key={tick}>
                  <line
                    className="tm-chart-grid"
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={y}
                    y2={y}
                  />
                  <text className="tm-chart-axis" x={PAD.left - 10} y={y + 3.5} textAnchor="end">
                    {formatAxis(tick)}
                  </text>
                </g>
              );
            })}

            <g clipPath={`url(#tm-clip-${gradientId})`}>
              {seriesPaths.map((entry, seriesIndex) =>
                entry.segments.map((segment) => (
                  <React.Fragment key={`${entry.id}-area-${segment.startIndex}`}>
                    {entry.area !== false ? (
                      <path
                        d={areaPath(segment.points, PAD.top + plotHeight)}
                        fill={`url(#tm-area-${gradientId}-${seriesIndex})`}
                      />
                    ) : null}
                    <path
                      d={linePath(segment.points)}
                      fill="none"
                      stroke={entry.color}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={entry.dashed ? "4 4" : undefined}
                    />
                  </React.Fragment>
                )),
              )}
            </g>

            {seriesPaths.map((entry) => {
              const last = entry.segments[entry.segments.length - 1]?.points.at(-1);
              if (!last) return null;
              return (
                <g key={`${entry.id}-last`}>
                  <circle cx={last.x} cy={last.y} r="5" fill={entry.color} opacity="0.15" />
                  <circle cx={last.x} cy={last.y} r="2" fill={entry.color} />
                </g>
              );
            })}

            {tickIndices.map((index, tickPosition) => {
              if (!timestamps[index]) return null;
              const x = xForTimestamp(timestamps[index]);
              const anchor = tickPosition === 0 ? "start" : tickPosition === tickIndices.length - 1 ? "end" : "middle";
              return (
                <text key={`${index}-${tickPosition}`} className="tm-chart-axis" x={x} y={height - 6} textAnchor={anchor}>
                  {formatClock(timestamps[index], timeZone)}
                </text>
              );
            })}

            {hoverIndex !== null ? (
              <g>
                <line
                  className="tm-chart-crosshair"
                  x1={hoverX}
                  x2={hoverX}
                  y1={PAD.top}
                  y2={PAD.top + plotHeight}
                />
                {seriesPaths.map((entry) => {
                  const value = entry.values[hoverIndex];
                  if (value === null || !Number.isFinite(value)) return null;
                  return (
                    <circle
                      key={entry.id}
                      cx={hoverX}
                      cy={yForValue(value)}
                      r="3"
                      fill={entry.color}
                      stroke="var(--tm-tooltip-bg)"
                      strokeWidth="1.5"
                    />
                  );
                })}
              </g>
            ) : null}
          </svg>

          {hoverIndex !== null ? (
            <div className="tm-chart-tooltip" style={{ left: tooltipLeft }}>
              <span className="tm-chart-tooltip-time">{formatClock(timestamps[hoverIndex], timeZone)}</span>
              {series.map((entry) => {
                const value = entry.values[hoverIndex];
                return (
                  <span className="tm-chart-tooltip-row" key={entry.id}>
                    <i style={{ background: entry.color }} aria-hidden="true" />
                    <span>{entry.label}</span>
                    <strong>{value === null || value === undefined ? "Unavailable" : format(value)}</strong>
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="tm-chart-empty" style={{ height }}>
          Waiting for telemetry history…
        </div>
      )}
    </div>
  );
}
