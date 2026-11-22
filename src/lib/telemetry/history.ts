import type { HistoryPoint, HistoryResponse, Snapshot } from "./types";

export const HISTORY_LIMIT = 300;

function safeTime(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function historyPointFromSnapshot(snapshot: Snapshot): HistoryPoint | null {
  const t = safeTime(snapshot.timestamp);
  if (t === null) return null;
  const diskRead = snapshot.storage.devices.reduce(
    (total, device) => total + (device.readBytesPerSecond || 0),
    0,
  );
  const diskWrite = snapshot.storage.devices.reduce(
    (total, device) => total + (device.writeBytesPerSecond || 0),
    0,
  );
  return {
    t,
    cpu: snapshot.cpu.usagePercent,
    gpu: snapshot.gpu?.usagePercent ?? null,
    memory: snapshot.memory.utilizationPercent,
    cpuTemp: snapshot.cpu.temperatureC,
    gpuTemp: snapshot.gpu?.temperatureC ?? null,
    rx: snapshot.network.rxBytesPerSecond,
    tx: snapshot.network.txBytesPerSecond,
    diskRead,
    diskWrite,
  };
}

export function historyPointsFromApi(response: HistoryResponse): HistoryPoint[] {
  const timestamps = response.timestamps ?? [];
  if (timestamps.length === 0) return [];

  const series = response.series ?? ({} as HistoryResponse["series"]);
  const points: HistoryPoint[] = [];

  for (let index = 0; index < timestamps.length; index += 1) {
    const t = safeTime(timestamps[index]);
    if (t === null) continue;
    points.push({
      t,
      cpu: series.cpuPercent?.[index] ?? null,
      gpu: series.gpuPercent?.[index] ?? null,
      memory: series.memoryPercent?.[index] ?? null,
      cpuTemp: series.cpuTempC?.[index] ?? null,
      gpuTemp: series.gpuTempC?.[index] ?? null,
      rx: series.rxBytesPerSecond?.[index] ?? null,
      tx: series.txBytesPerSecond?.[index] ?? null,
      diskRead: series.diskReadBytesPerSecond?.[index] ?? null,
      diskWrite: series.diskWriteBytesPerSecond?.[index] ?? null,
    });
  }

  return points.sort((a, b) => a.t - b.t);
}

export function mergeHistory(
  existing: HistoryPoint[],
  incoming: HistoryPoint[],
  limit = HISTORY_LIMIT,
): HistoryPoint[] {
  if (incoming.length === 0) return existing.slice(-limit);
  const byTime = new Map<number, HistoryPoint>();
  for (const point of existing) byTime.set(point.t, point);
  for (const point of incoming) byTime.set(point.t, point);
  return Array.from(byTime.values())
    .sort((a, b) => a.t - b.t)
    .slice(-limit);
}

export function appendHistoryPoint(
  existing: HistoryPoint[],
  point: HistoryPoint,
  limit = HISTORY_LIMIT,
): HistoryPoint[] {
  if (existing.length === 0) return [point];
  const latest = existing[existing.length - 1];
  if (point.t < latest.t) {
    // The API may have restarted. Replace the local tail with the newer sample.
    return [...existing.filter((entry) => entry.t < point.t), point].slice(-limit);
  }
  if (point.t === latest.t) {
    return [...existing.slice(0, -1), point].slice(-limit);
  }
  if (point.t - latest.t < 400) {
    return [...existing.slice(0, -1), point].slice(-limit);
  }
  return [...existing, point].slice(-limit);
}

export function historyValues(
  points: HistoryPoint[],
  key: keyof Pick<HistoryPoint, "cpu" | "gpu" | "memory" | "cpuTemp" | "gpuTemp" | "rx" | "tx" | "diskRead" | "diskWrite">,
): Array<number | null> {
  return points.map((point) => point[key]);
}

export function historyTimestamps(points: HistoryPoint[]): number[] {
  return points.map((point) => point.t);
}

export function seriesPeak(values: Array<number | null>): number {
  let peak = 0;
  for (const value of values) {
    if (value !== null && Number.isFinite(value) && value > peak) peak = value;
  }
  return peak;
}

export function aggregateStorageIo(snapshot: Snapshot): { read: number; write: number; iops: number } {
  return snapshot.storage.devices.reduce(
    (total, device) => ({
      read: total.read + (device.readBytesPerSecond || 0),
      write: total.write + (device.writeBytesPerSecond || 0),
      iops: total.iops + (device.iops || 0),
    }),
    { read: 0, write: 0, iops: 0 },
  );
}
