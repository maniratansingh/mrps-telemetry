import type {
  NetworkInterfaceTelemetry,
  SmartDevice,
  SmartTelemetry,
  StorageDeviceTelemetry,
  ThermalSensor,
} from "./types";

export function percentUsed(used: number, total: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, (used / total) * 100));
}

export function storageSummary(devices: StorageDeviceTelemetry[]) {
  const capacityBytes = devices.reduce((total, device) => total + (device.capacityBytes || 0), 0);
  const usedBytes = devices.reduce((total, device) => total + (device.usedBytes || 0), 0);
  const mountedCapacityBytes = devices
    .filter((device) => device.volumes.length > 0)
    .reduce((total, device) => total + (device.capacityBytes || 0), 0);
  return {
    capacityBytes,
    usedBytes,
    freeBytes: Math.max(0, capacityBytes - usedBytes),
    mountedCapacityBytes,
    percent: percentUsed(usedBytes, capacityBytes),
  };
}

export function smartKey(devicePath: string): string {
  return devicePath.replace(/^\/dev\//, "");
}

export function smartByDevice(smart: SmartTelemetry | null | undefined): Map<string, SmartDevice> {
  const map = new Map<string, SmartDevice>();
  for (const device of smart?.devices ?? []) {
    map.set(smartKey(device.device), device);
  }
  return map;
}

export function hottestSensor(sensors: ThermalSensor[]): ThermalSensor | null {
  return sensors.reduce<ThermalSensor | null>((hottest, sensor) => {
    if (sensor.valueC === null || !Number.isFinite(sensor.valueC)) return hottest;
    if (!hottest || (hottest.valueC ?? -Infinity) < sensor.valueC) return sensor;
    return hottest;
  }, null);
}

export function primaryNetworkInterfaces(interfaces: NetworkInterfaceTelemetry[]): NetworkInterfaceTelemetry[] {
  const priority = new Map([
    ["eno1", 0],
    ["eth0", 0],
    ["enp", 0],
    ["tailscale0", 1],
    ["wg0", 2],
    ["docker0", 3],
  ]);

  return [...interfaces].sort((a, b) => {
    const aPriority = priority.get(a.name) ?? (a.kind === "ethernet" ? 4 : 9);
    const bPriority = priority.get(b.name) ?? (b.kind === "ethernet" ? 4 : 9);
    if (aPriority !== bPriority) return aPriority - bPriority;
    if (a.state !== b.state) return a.state === "up" ? -1 : 1;
    return b.rxBytesPerSecond + b.txBytesPerSecond - (a.rxBytesPerSecond + a.txBytesPerSecond);
  });
}

export function visibleNetworkInterfaces(
  interfaces: NetworkInterfaceTelemetry[],
  showAll: boolean,
): NetworkInterfaceTelemetry[] {
  const sorted = primaryNetworkInterfaces(interfaces);
  if (showAll) return sorted;
  const primary = sorted.filter(
    (entry) =>
      entry.name === "eno1" ||
      entry.name === "eth0" ||
      entry.kind === "ethernet" ||
      entry.name === "tailscale0" ||
      entry.name === "wg0" ||
      entry.name === "docker0",
  );
  return primary.length > 0 ? primary : sorted.slice(0, 4);
}

export function formatNetworkAxis(value: number): string {
  const bits = Math.max(0, value) * 8;
  if (bits >= 1_000_000_000) return `${(bits / 1_000_000_000).toFixed(1)}G`;
  if (bits >= 1_000_000) return `${(bits / 1_000_000).toFixed(1)}M`;
  if (bits >= 1_000) return `${(bits / 1_000).toFixed(0)}K`;
  return `${bits.toFixed(0)}`;
}

export function formatDiskAxis(value: number): string {
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)}G`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)}M`;
  if (value >= 1024) return `${(value / 1024).toFixed(0)}K`;
  return `${value.toFixed(0)}`;
}

export function storageKindLabel(kind: StorageDeviceTelemetry["kind"]): string {
  if (kind === "nvme") return "NVMe";
  if (kind === "ssd") return "SSD";
  if (kind === "hdd") return "HDD";
  return "Virtual";
}

export function hasAtaSmart(device: SmartDevice | undefined): boolean {
  return Boolean(
    device &&
      (device.reallocatedSectors !== null ||
        device.pendingSectors !== null ||
        device.offlineUncorrectable !== null ||
        device.udmaCrcErrors !== null),
  );
}

export function hasNvmeSmart(device: SmartDevice | undefined): boolean {
  return Boolean(
    device &&
      (device.nvmePercentageUsed !== null ||
        device.nvmeAvailableSparePercent !== null ||
        device.nvmeCriticalWarning !== null ||
        device.nvmeMediaDataIntegrityErrors !== null ||
        device.nvmeErrorInformationLogEntries !== null),
  );
}

export function connectionLabel(connection: string): string {
  if (connection === "live") return "Live";
  if (connection === "stale") return "Delayed";
  if (connection === "offline") return "Server offline";
  if (connection === "error") return "Link lost";
  return "Connecting";
}
