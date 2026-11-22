export interface ApiHealth {
  status: string;
  service: string;
  timestamp: string;
}

export interface HostVolume {
  mount: string;
  fstype: string;
  totalBytes: number;
}

export interface HostStorageDevice {
  id: string;
  label: string;
  model: string;
  kind: "hdd" | "ssd" | "nvme" | "virtual";
  capacityBytes: number;
  volumes: HostVolume[];
}

export interface HostNetworkInterface {
  name: string;
  kind: "ethernet" | "wifi" | "virtual" | "loopback";
  ipv4: string | null;
  ipv6: string | null;
  mac: string;
  speedMbps?: number;
}

export interface HostCapabilities {
  platform: {
    os: string;
    arch: string;
    kernel: string;
    raspberryPi: boolean;
    deviceModel?: string;
  };
  cpu: {
    vendor: string | null;
    model: string;
    physicalCores: number | null;
    logicalThreads: number;
  };
  gpu: {
    present: boolean;
    vendor: string | null;
    model: string | null;
    driver: string | null;
    metrics: boolean;
  };
  smart: { tool: boolean; devices: number; reported: number };
  thermal: { sensors: number; fans: number };
  wireguard: { present: boolean; tool: boolean; interfaces: number };
  tailscale: { present: boolean; state: string | null; tool: boolean };
  tools: Record<string, boolean>;
}

export interface HostInfo {
  id: string;
  name: string;
  hostname: string;
  os: string;
  osVersion: string;
  kernel: string;
  arch: string;
  ipv4: string;
  timezone: string;
  spec: {
    cpu: {
      model: string;
      physicalCores: number;
      logicalThreads: number;
    };
    gpu: {
      model: string;
      vendor: string;
      vramBytes: number;
      driver: string;
    } | null;
    memory: {
      totalBytes: number;
    };
    storage: HostStorageDevice[];
    network: HostNetworkInterface[];
  };
  capabilities?: HostCapabilities;
}

export interface PerCoreReading {
  index: number;
  usagePercent: number;
}

export interface PerThreadReading {
  index: number;
  usagePercent: number;
  clockGhz?: number;
}

export interface CpuTelemetry {
  usagePercent: number;
  temperatureC: number | null;
  frequencyGhz: number;
  loadAverage: number[];
  processCount: number;
  perCore: PerCoreReading[];
  perThread: PerThreadReading[];
}

export interface GpuTelemetry {
  model: string;
  usagePercent: number;
  temperatureC: number | null;
  vramTotalBytes: number;
  vramUsedBytes: number;
  memoryUtilizationPercent: number | null;
  coreClockMhz: number | null;
  memoryClockMhz: number | null;
  powerWatts: number | null;
  fanPercent: number | null;
}

export interface MemoryTelemetry {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  cachedBytes: number;
  buffersBytes: number;
  freeBytes: number;
  swapTotalBytes: number;
  swapUsedBytes: number;
  utilizationPercent: number;
}

export interface ThermalSensor {
  id: string;
  label: string;
  zone: "cpu" | "gpu" | "board" | "storage" | "other";
  valueC: number | null;
  source?: string;
}

export interface FanTelemetry {
  id: string;
  label: string;
  rpm?: number | null;
  percent?: number | null;
}

export interface ThermalTelemetry {
  sensors: ThermalSensor[];
  fans: FanTelemetry[];
}

export interface StorageDeviceTelemetry {
  id: string;
  label: string;
  model: string;
  kind: "hdd" | "ssd" | "nvme" | "virtual";
  capacityBytes: number;
  usedBytes: number;
  temperatureC: number | null;
  healthPercent: number | null;
  smartStatus: "passed" | "warning" | "unavailable";
  readBytesPerSecond: number;
  writeBytesPerSecond: number;
  iops: number;
  volumes: Array<{
    mount: string;
    fstype: string;
    usedBytes: number;
    totalBytes: number;
  }>;
}

export interface SmartDevice {
  device: string;
  model: string | null;
  health: string | null;
  status: string;
  error: string | null;
  temperatureC: number | null;
  powerOnHours: number | null;
  reallocatedSectors: number | null;
  pendingSectors: number | null;
  offlineUncorrectable: number | null;
  udmaCrcErrors: number | null;
  nvmePercentageUsed: number | null;
  nvmeAvailableSparePercent: number | null;
  nvmeCriticalWarning: string | null;
  nvmeMediaDataIntegrityErrors: number | null;
  nvmeErrorInformationLogEntries: number | null;
}

export interface SmartTelemetry {
  status: string;
  devices: SmartDevice[];
}

export interface NetworkInterfaceTelemetry {
  name: string;
  kind: "ethernet" | "wifi" | "virtual" | "loopback";
  state: "up" | "down";
  ipv4: string | null;
  ipv6: string | null;
  mac: string;
  speedMbps?: number;
  rxBytesPerSecond: number;
  txBytesPerSecond: number;
  rxTotalBytes: number;
  txTotalBytes: number;
  rxPackets?: number;
  txPackets?: number;
  errors: number;
  drops: number;
}

export interface NetworkTelemetry {
  rxBytesPerSecond: number;
  txBytesPerSecond: number;
  rxTotalBytes: number;
  txTotalBytes: number;
  interfaces: NetworkInterfaceTelemetry[];
}

export interface CpuProcess {
  pid: number;
  name: string;
  user?: string;
  cpuPercent: number;
  memoryBytes: number;
  threadCount?: number;
}

export interface GpuProcess {
  pid: number;
  name: string;
  type?: "graphics" | "compute";
  vramBytes?: number;
  usagePercent?: number | null;
}

export interface ProcessesTelemetry {
  cpu: CpuProcess[];
  gpu: GpuProcess[];
}

export interface WireGuardPeer {
  latestHandshakeSecondsAgo: number | null;
  transfer: {
    receivedBytes: number;
    sentBytes: number;
  };
}

export interface WireGuardInterface {
  name: string;
  listeningPort: number;
  peerCount: number;
  peers: WireGuardPeer[];
}

export interface WireGuardTelemetry {
  status: string;
  interfaces: WireGuardInterface[];
}

export interface TailscaleTelemetry {
  status: string;
  backendState: string;
  selfOnline: boolean;
  peerCount: number;
  onlinePeers: number;
  offlinePeers: number;
}

export interface SystemTelemetry {
  hostname: string;
  os: string;
  osVersion: string;
  kernel: string;
  arch: string;
  uptimeSeconds: number;
  bootTime: string;
  processCount: number;
  timezone: string;
  loggedInUsers?: number;
}

export interface Snapshot {
  serverId: string;
  timestamp: string;
  online: boolean;
  lastSeen: string;
  cpu: CpuTelemetry;
  gpu: GpuTelemetry | null;
  memory: MemoryTelemetry;
  thermal: ThermalTelemetry;
  storage: { devices: StorageDeviceTelemetry[] };
  wireguard: WireGuardTelemetry;
  tailscale: TailscaleTelemetry;
  smart: SmartTelemetry;
  network: NetworkTelemetry;
  processes: ProcessesTelemetry;
  system: SystemTelemetry;
}

export interface HistorySeries {
  cpuPercent: number[];
  gpuPercent: Array<number | null>;
  memoryPercent: number[];
  cpuTempC: Array<number | null>;
  gpuTempC: Array<number | null>;
  rxBytesPerSecond: number[];
  txBytesPerSecond: number[];
  diskReadBytesPerSecond: number[];
  diskWriteBytesPerSecond: number[];
}

export interface HistoryResponse {
  timestamps: string[];
  series: HistorySeries;
}

export interface HistoryPoint {
  t: number;
  cpu: number | null;
  gpu: number | null;
  memory: number | null;
  cpuTemp: number | null;
  gpuTemp: number | null;
  rx: number | null;
  tx: number | null;
  diskRead: number | null;
  diskWrite: number | null;
}

export type ConnectionState =
  | "connecting"
  | "live"
  | "stale"
  | "offline"
  | "error";

export interface TelemetryState {
  host: HostInfo | null;
  snapshot: Snapshot | null;
  history: HistoryPoint[];
  health: ApiHealth | null;
  connection: ConnectionState;
  lastSuccessAt: number | null;
  lastServerTimestamp: string | null;
  error: string | null;
  initialLoading: boolean;
  refreshing: boolean;
  historySource: "api" | "live" | "none";
  apiBase: string;
  historyWindow: number;
}
