export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartScale {
  min: number;
  max: number;
  ticks: number[];
}

const round = (value: number) => Math.round(value * 100) / 100;

export function niceScale(maxValue: number, tickCount = 4, minValue = 0, hardMax?: number): ChartScale {
  if (hardMax !== undefined) {
    const ticks = Array.from({ length: tickCount + 1 }, (_, index) =>
      round(minValue + ((hardMax - minValue) * index) / tickCount),
    );
    return { min: minValue, max: hardMax, ticks };
  }

  if (!Number.isFinite(maxValue) || maxValue <= minValue) {
    const fallback = minValue + 1;
    return { min: minValue, max: fallback, ticks: [minValue, fallback] };
  }

  const rawStep = (maxValue - minValue) / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10;
  const step = niceResidual * magnitude;
  const niceMax = Math.ceil(maxValue / step) * step;
  const steps = Math.max(1, Math.round((niceMax - minValue) / step));
  const ticks: number[] = [];
  for (let index = 0; index <= steps; index += 1) {
    ticks.push(round(minValue + index * step));
  }
  if (ticks[ticks.length - 1] < niceMax) ticks.push(niceMax);
  return { min: minValue, max: niceMax, ticks };
}

export function linePath(points: ChartPoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${round(points[0].x)} ${round(points[0].y)}`;

  const x = points.map((point) => point.x);
  const y = points.map((point) => point.y);
  const n = points.length;

  const slopes: number[] = [];
  for (let index = 0; index < n - 1; index += 1) {
    const dx = x[index + 1] - x[index];
    slopes.push(dx === 0 ? 0 : (y[index + 1] - y[index]) / dx);
  }

  const tangents = new Array<number>(n);
  tangents[0] = slopes[0] ?? 0;
  tangents[n - 1] = slopes[n - 2] ?? 0;
  for (let index = 1; index < n - 1; index += 1) {
    const previous = slopes[index - 1];
    const next = slopes[index];
    tangents[index] = previous * next <= 0 ? 0 : (previous + next) / 2;
  }

  for (let index = 0; index < n - 1; index += 1) {
    const slope = slopes[index];
    if (slope === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const a = tangents[index] / slope;
    const b = tangents[index + 1] / slope;
    const magnitude = Math.hypot(a, b);
    if (magnitude > 3) {
      tangents[index] = (3 * a * slope) / magnitude;
      tangents[index + 1] = (3 * b * slope) / magnitude;
    }
  }

  let path = `M ${round(x[0])} ${round(y[0])}`;
  for (let index = 0; index < n - 1; index += 1) {
    const dx = (x[index + 1] - x[index]) / 3;
    const c1x = x[index] + dx;
    const c1y = y[index] + tangents[index] * dx;
    const c2x = x[index + 1] - dx;
    const c2y = y[index + 1] - tangents[index + 1] * dx;
    path += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(x[index + 1])} ${round(y[index + 1])}`;
  }
  return path;
}

export function areaPath(points: ChartPoint[], baseline: number): string {
  if (points.length < 2) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)} L ${round(last.x)} ${round(baseline)} L ${round(first.x)} ${round(baseline)} Z`;
}

export function chartPeak(values: Array<number | null | undefined>): number {
  let peak = 0;
  for (const value of values) {
    if (value !== null && value !== undefined && Number.isFinite(value) && value > peak) peak = value;
  }
  return peak;
}

export function formatAxisValue(value: number, unit?: string): string {
  if (unit === "%") return `${Math.round(value)}%`;
  if (unit === "°C") return `${Math.round(value)}°`;
  if (unit === " Gbps" || unit === " Mbps" || unit === " Kbps" || unit === " bps") {
    return `${Math.round(value)}`;
  }
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (Math.abs(value) >= 100) return `${Math.round(value)}`;
  if (Math.abs(value) >= 10) return `${value.toFixed(0)}`;
  return `${value.toFixed(1)}`;
}
