const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

function read(file) {
  try { return fs.readFileSync(file, 'utf8').trim(); }
  catch { return null; }
}

function detectGpu() {
  // nvidia-smi only covers one vendor. When it is unavailable, report what the
  // kernel exposes so the dashboard adapts instead of claiming there is no GPU.
  try {
    const cards = fs.readdirSync('/sys/class/drm').filter(name => /^card\d+$/.test(name));
    const vendors = {
      '0x10de': 'NVIDIA',
      '0x1002': 'AMD',
      '0x8086': 'Intel',
      '0x13b5': 'ARM',
      '0x1af4': 'Virtio',
      '0x15ad': 'VMware',
      '0x1234': 'QEMU',
      '0x14e4': 'Broadcom',
      '0x1a03': 'ASPEED'
    };

    for (const card of cards) {
      const base = `/sys/class/drm/${card}/device`;
      const vendorId = read(`${base}/vendor`);
      if (!vendorId) continue;

      let driver;
      try { driver = path.basename(fs.readlinkSync(`${base}/driver`)); } catch { driver = undefined; }

      const vendor = vendors[vendorId.toLowerCase()] || vendorId;
      let model = `${vendor} GPU`;

      if (vendor === 'Broadcom') {
        const board = read('/proc/device-tree/model') || read('/sys/firmware/devicetree/base/model');
        if (board) model = board.replace(/\u0000/g, '').trim();
      }

      try {
        const { execFileSync } = require('node:child_process');
        const lspci = execFileSync('lspci', ['-nn'], { timeout: 1500, encoding: 'utf8' });
        const line = lspci.split('\n').find(entry =>
          /VGA compatible controller|3D controller|Display controller/i.test(entry)
        );
        if (line) {
          model = line.split(':').slice(2).join(':').trim()
            .replace(/\s*\[[0-9a-f]{4}:[0-9a-f]{4}\].*$/i, '')
            .replace(/\s*\(rev .*\)$/i, '')
            .trim() || model;
        }
      } catch { /* lspci is optional */ }

      return { model, vendor, vramBytes: 0, driver };
    }
  } catch { /* /sys/class/drm is not available */ }

  return null;
}

function number(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value : null;
}

function sum(values) {
  const valid = values.filter(v => typeof v === 'number' && Number.isFinite(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) : null;
}

function archName(value) {
  return value === 'x64' ? 'x86_64' : value;
}

function deviceKind(device) {
  const name = device.kernel_name || device.name || '';
  if (/^(loop|ram|zram|dm-|md)/.test(name)) return 'virtual';
  if (/^nvme/.test(name)) return 'nvme';
  if (device.rotational === true) return 'hdd';
  return 'ssd';
}

function networkKind(name) {
  if (name === 'lo') return 'loopback';
  if (fs.existsSync(`/sys/class/net/${name}/wireless`)) return 'wifi';
  if (/^(docker|veth|br-|virbr|tailscale|wg|tun|tap|zt|podman)/i.test(name)) {
    return 'virtual';
  }
  return 'ethernet';
}

function networkAddresses() {
  const result = os.networkInterfaces();
  return result || {};
}

function interfaceDetails(name) {
  const all = networkAddresses();
  const addresses = all[name] || [];
  const ipv4 = addresses.find(a => a.family === 'IPv4' || a.family === 4);
  const ipv6 = addresses.find(a => a.family === 'IPv6' || a.family === 6);
  const mac = addresses.find(a => a.mac && a.mac !== '00:00:00:00:00:00');

  const speedRaw = Number(read(`/sys/class/net/${name}/speed`));
  return {
    ipv4: ipv4 ? ipv4.address : null,
    ipv6: ipv6 ? ipv6.address : null,
    mac: mac ? mac.mac : read(`/sys/class/net/${name}/address`),
    speedMbps: Number.isFinite(speedRaw) && speedRaw > 0 ? speedRaw : undefined
  };
}

function processCount() {
  try {
    return fs.readdirSync('/proc').filter(name => /^\d+$/.test(name)).length;
  } catch {
    return null;
  }
}

function physicalCoreGroups(threads) {
  const groups = new Map();

  for (const thread of threads) {
    const base = `/sys/devices/system/cpu/cpu${thread.index}/topology`;
    const packageId = read(path.join(base, 'physical_package_id'));
    const coreId = read(path.join(base, 'core_id'));
    if (packageId === null || coreId === null) continue;

    const key = `${packageId}:${coreId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(thread);
  }

  if (!groups.size) return undefined;

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, members], index) => ({
      index,
      usagePercent: sum(members.map(item => item.usagePercent)) / members.length
    }));
}

function filesystemForMount(storage, mount) {
  return (storage.filesystems || []).find(item => item.mountpoint === mount);
}

function rootDisk(device, byName) {
  let current = device;
  const seen = new Set();

  while (current && current.parent && byName.has(current.parent) &&
         !seen.has(current.parent)) {
    seen.add(current.parent);
    current = byName.get(current.parent);
  }
  return current;
}


let toolCache = null;

function commandExists(command) {
  try {
    execFileSync('sh', ['-c', `command -v ${command}`], { timeout: 1000, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function systemTools() {
  if (!toolCache) {
    toolCache = {
      nvidiaSmi: commandExists('nvidia-smi'),
      smartctl: commandExists('smartctl'),
      wg: commandExists('wg'),
      tailscale: commandExists('tailscale'),
      lspci: commandExists('lspci'),
      lsblk: commandExists('lsblk'),
      sensors: commandExists('sensors')
    };
  }
  return toolCache;
}

function deviceTreeModel() {
  const raw = read('/proc/device-tree/model') || read('/sys/firmware/devicetree/base/model');
  return raw ? raw.replace(/\u0000/g, '').trim() : null;
}

function buildCapabilities(data) {
  const system = data.system || {};
  const cpu = system.cpu || {};
  const gpuData = data.gpu && data.gpu.gpu ? data.gpu.gpu : null;
  const detectedGpu = gpuData ? null : detectGpu();
  const devices = (data.storage && data.storage.devices) || [];
  const smartDevices = (data.smart && data.smart.devices) || [];
  const sensors = (data.thermal && data.thermal.sensors) || [];
  const fans = (data.thermal && data.thermal.fans) || [];
  const wireguard = (data.wireguard && data.wireguard.interfaces) || [];
  const tailscale = data.tailscale || {};
  const tailscaleState = tailscale.backend_state ?? tailscale.backendState ?? null;
  const tools = systemTools();
  const model = deviceTreeModel();
  const cpuModel = cpu.model || os.cpus()[0]?.model || 'Unknown CPU';
  const cpuVendor = /AMD/i.test(cpuModel) ? 'AMD'
    : /Intel/i.test(cpuModel) ? 'Intel'
      : /ARM|aarch64|Cortex|Apple|Broadcom/i.test(cpuModel) ? 'ARM'
        : null;

  return {
    platform: {
      os: os.platform(),
      arch: archName(system.architecture || os.arch()),
      kernel: system.kernel || os.release(),
      raspberryPi: /raspberry pi/i.test(model || ''),
      deviceModel: model || undefined
    },
    cpu: {
      vendor: cpuVendor,
      model: cpuModel,
      physicalCores: cpu.physical_cores || null,
      logicalThreads: cpu.logical_threads || os.cpus().length
    },
    gpu: {
      present: Boolean(gpuData || detectedGpu),
      vendor: gpuData ? 'NVIDIA' : (detectedGpu && detectedGpu.vendor) || null,
      model: gpuData ? (gpuData.model || null) : (detectedGpu && detectedGpu.model) || null,
      driver: gpuData ? (gpuData.driver_version || null) : (detectedGpu && detectedGpu.driver) || null,
      metrics: Boolean(gpuData)
    },
    smart: {
      tool: tools.smartctl,
      devices: smartDevices.length,
      reported: smartDevices.filter(device => !device.error).length
    },
    thermal: { sensors: sensors.length, fans: fans.length },
    wireguard: {
      present: wireguard.length > 0,
      tool: tools.wg,
      interfaces: wireguard.length
    },
    tailscale: {
      present: Boolean(tailscaleState && tailscaleState !== 'unavailable'),
      state: tailscaleState,
      tool: tools.tailscale
    },
    tools
  };
}

function buildHost(data) {
  const system = data.system || {};
  const cpu = system.cpu || {};
  const memory = data.memory || {};
  const gpuData = data.gpu && data.gpu.gpu ? data.gpu.gpu : null;
  const storageData = data.storage || {};
  const devices = storageData.devices || [];
  const filesystems = storageData.filesystems || [];
  const byName = new Map();

  for (const device of devices) {
    if (device.kernel_name) byName.set(device.kernel_name, device);
    if (device.name) byName.set(device.name, device);
  }

  const volumesByDisk = new Map();

  for (const item of devices) {
    const mounts = item.mountpoints || [];
    for (const mount of mounts) {
      const root = rootDisk(item, byName);
      if (!root || !root.kernel_name) continue;

      const filesystem = filesystemForMount(storageData, mount);
      if (!volumesByDisk.has(root.kernel_name)) {
        volumesByDisk.set(root.kernel_name, []);
      }

      const volumes = volumesByDisk.get(root.kernel_name);
      if (!volumes.some(volume => volume.mount === mount)) {
        volumes.push({
          mount,
          fstype: filesystem ? filesystem.type : item.filesystem || undefined,
          totalBytes: filesystem ? filesystem.size_bytes : 0
        });
      }
    }
  }

  const physicalDisks = devices.filter(device =>
    device.type === 'disk' && !/^(loop|ram|zram)/.test(device.kernel_name || '')
  );

  const storage = physicalDisks.map(device => ({
    id: device.kernel_name || device.name,
    label: device.model || device.name,
    model: device.model || undefined,
    kind: deviceKind(device),
    capacityBytes: device.size_bytes || 0,
    volumes: volumesByDisk.get(device.kernel_name || device.name) || []
  }));

  const interfaces = (data.network && data.network.interfaces) || [];
  const network = interfaces.map(item => ({
    name: item.name,
    kind: networkKind(item.name),
    ...interfaceDetails(item.name)
  }));

  const primaryInterface = network.find(item =>
    (item.kind === 'ethernet' || item.kind === 'wifi') && item.ipv4
  );

  const osString = system.operating_system || 'Linux';
  const osMatch = osString.match(/^(.+?)\s+(\d[\w.\- ]*)$/);

  return {
    id: system.hostname || os.hostname(),
    name: system.hostname || os.hostname(),
    hostname: system.hostname || os.hostname(),
    os: osMatch ? osMatch[1] : osString,
    osVersion: osMatch ? osMatch[2].trim() : undefined,
    kernel: system.kernel || os.release(),
    arch: archName(system.architecture || os.arch()),
    ipv4: primaryInterface ? primaryInterface.ipv4 : undefined,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    spec: {
      cpu: {
        model: cpu.model || os.cpus()[0]?.model || 'Unknown CPU',
        physicalCores: cpu.physical_cores || null,
        logicalThreads: cpu.logical_threads || os.cpus().length
      },
      gpu: gpuData ? {
        model: gpuData.model || 'Unknown GPU',
        vendor: 'NVIDIA',
        vramBytes: (gpuData.vram_total_mib || 0) * 1048576,
        driver: gpuData.driver_version || undefined
      } : detectGpu(),
      memory: {
        totalBytes: memory.total || 0
      },
      storage,
      network,
      motherboard: read('/sys/class/dmi/id/board_name') || undefined,
      bios: read('/sys/class/dmi/id/bios_version') || undefined
    },
    capabilities: buildCapabilities(data)
  };
}


function smartField(obj, aliases) {
  const wanted = new Set(aliases.map(x => x.toLowerCase().replace(/[^a-z0-9]/g, "")));
  function walk(value) {
    if (!value || typeof value !== "object") return undefined;
    for (const [key, val] of Object.entries(value)) {
      if (wanted.has(key.toLowerCase().replace(/[^a-z0-9]/g, "")) &&
          val !== null && val !== undefined) return val;
    }
    for (const val of Object.values(value)) {
      const found = walk(val);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  return walk(obj);
}

function buildSnapshot(data) {
  const timestamp = data.timestamp || new Date().toISOString();
  const rawCpu = data.cpu || {};
  const rawMemory = data.memory || {};
  const rawSystem = data.system || {};
  const rawGpu = data.gpu && data.gpu.gpu ? data.gpu.gpu : null;
  const rawThermal = data.thermal || {};
  const rawStorage = data.storage || {};
  const rawDisk = data.disk || {};
  const rawNetwork = data.network || {};
  const rawProcesses = data.processes || {};
  const rawSmart = data.smart || {};
  const rawWireGuard = data.wireguard || {};
  const rawTailscale = data.tailscale || {};


  const rawThreads = (rawCpu.cores || []).map(item => ({
    index: item.core,
    usagePercent: number(item.usage_percent),
    clockGhz: (() => {
      const mhz = (rawSystem.cpu?.frequencies_mhz || os.cpus().map(c => c.speed))[item.core];
      return Number.isFinite(mhz) ? mhz / 1000 : undefined;
    })()
  }));

  const perCore = physicalCoreGroups(rawThreads);
  const cpuUsage = number(rawCpu.aggregate?.usage_percent);
  const cpuTemperature = (rawThermal.sensors || []).find(sensor =>
    /cpu|tctl|tdie|k10temp/i.test(`${sensor.chip} ${sensor.sensor}`) &&
    Number.isFinite(sensor.temperature_c)
  );

  const gpuTemperature = rawGpu ? number(rawGpu.temperature_celsius) : null;

  const thermalSensors = (rawThermal.sensors || [])
    .filter(sensor => sensor.temperature_c !== undefined)
    .map(sensor => {
      const source = `${sensor.chip || ''} ${sensor.sensor || ''}`;
      let zone = 'other';
      if (/cpu|tctl|tdie|k10temp/i.test(source)) zone = 'cpu';
      else if (/gpu|nvidia/i.test(source)) zone = 'gpu';
      else if (/nvme|ssd|disk/i.test(source)) zone = 'storage';
      else if (/board|motherboard|it87|nct|acpitz/i.test(source)) zone = 'board';

      return {
        id: `${sensor.chip || 'sensor'}:${sensor.sensor || 'temperature'}`,
        label: `${sensor.chip || 'Sensor'} ${sensor.sensor || ''}`.trim(),
        zone,
        valueC: number(sensor.temperature_c),
        source: sensor.chip || undefined
      };
    });

  const fans = (rawThermal.sensors || [])
    .filter(sensor => sensor.fan_rpm !== undefined)
    .map(sensor => ({
      id: `${sensor.chip || 'fan'}:${sensor.sensor || 'fan'}`,
      label: `${sensor.chip || 'Fan'} ${sensor.sensor || ''}`.trim(),
      rpm: number(sensor.fan_rpm),
      percent: null
    }));

  const storageDevices = rawStorage.devices || [];
  const allDevices = new Map();
  for (const item of storageDevices) {
    if (item.kernel_name) allDevices.set(item.kernel_name, item);
  }

  const smartDevices = rawSmart.devices || [];
  const diskDevices = rawDisk.devices || [];

  const physicalStorage = storageDevices.filter(device =>
    device.type === 'disk' && !/^(loop|ram|zram)/.test(device.kernel_name || '')
  );

  const storage = physicalStorage.map(device => {
    const name = device.kernel_name || device.name;
    const smart = smartDevices.find(item =>
      item.device && item.device.split('/').pop() === name
    );
    const io = diskDevices.find(item => item.name === name);
    const volumes = [];

    for (const item of storageDevices) {
      const root = rootDisk(item, allDevices);
      if (!root || root.kernel_name !== name) continue;

      for (const mount of item.mountpoints || []) {
        const filesystem = filesystemForMount(rawStorage, mount);
        if (!filesystem || volumes.some(volume => volume.mount === mount)) continue;
        volumes.push({
          mount,
          fstype: filesystem.type,
          usedBytes: filesystem.used_bytes,
          totalBytes: filesystem.size_bytes
        });
      }
    }

    const health = smart && smart.health ? smart.health.toUpperCase() : '';
    let smartStatus = 'unavailable';
    if (/PASSED|OK|HEALTHY/.test(health)) smartStatus = 'passed';
    else if (/FAILED|FAIL|WARNING|CRITICAL/.test(health)) smartStatus = 'warning';

    const healthPercent = smart && smart.nvme_percentage_used !== null &&
      smart.nvme_percentage_used !== undefined
      ? Math.max(0, Math.min(100, 100 - smart.nvme_percentage_used))
      : null;

    return {
      id: name,
      label: device.model || name,
      model: device.model || undefined,
      kind: deviceKind(device),
      capacityBytes: device.size_bytes || 0,
      usedBytes: sum(volumes.map(volume => volume.usedBytes)) || 0,
      temperatureC: smart ? number(smart.temperature_c) : null,
      healthPercent,
      smartStatus,
      readBytesPerSecond: io ? number(io.read_bytes_per_sec) : null,
      writeBytesPerSecond: io ? number(io.write_bytes_per_sec) : null,
      iops: io ? sum([number(io.reads_per_sec), number(io.writes_per_sec)]) : null,
      volumes
    };
  });

  const interfaces = (rawNetwork.interfaces || []).map(item => {
    const kind = networkKind(item.name);
    const details = interfaceDetails(item.name);
    return {
      name: item.name,
      kind,
      state: item.state === 'up' ? 'up' : 'down',
      ipv4: details.ipv4,
      ipv6: details.ipv6,
      mac: details.mac,
      speedMbps: details.speedMbps,
      rxBytesPerSecond: number(item.rx_bytes_per_sec),
      txBytesPerSecond: number(item.tx_bytes_per_sec),
      rxTotalBytes: number(item.rx_bytes),
      txTotalBytes: number(item.tx_bytes),
      errors: sum([number(item.rx_errors), number(item.tx_errors)]),
      drops: sum([number(item.rx_dropped), number(item.tx_dropped)])
    };
  });

  let aggregateInterfaces = interfaces.filter(item =>
    (item.kind === 'ethernet' || item.kind === 'wifi') && item.state === 'up'
  );
  if (!aggregateInterfaces.length) {
    aggregateInterfaces = interfaces.filter(item =>
      item.kind !== 'loopback' && item.state === 'up'
    );
  }

  const processList = (rawProcesses.processes || [])
    .slice()
    .sort((a, b) => (b.cpu_percent || 0) - (a.cpu_percent || 0))
    .slice(0, 8)
    .map(item => ({
      pid: item.pid,
      name: item.name,
      cpuPercent: number(item.cpu_percent),
      memoryBytes: number(item.rss_bytes)
    }));

  const gpuProcessesRaw = rawGpu && data.gpu.processes
    ? (data.gpu.processes.data || []) : [];

  const gpuProcesses = gpuProcessesRaw.slice(0, 10).map(item => ({
    pid: item.pid,
    name: item.name || item.process_name || 'GPU process',
    type: item.type || 'compute',
    vramBytes: item.used_memory_mib !== undefined
      ? item.used_memory_mib * 1048576 : null,
    usagePercent: null
  }));

  const uptime = number(rawSystem.uptime_seconds);
  const processTotal = processCount();

  const memoryTotal = number(rawMemory.total);
  const memoryUsed = number(rawMemory.used);

  const networkRx = sum(aggregateInterfaces.map(item => item.rxBytesPerSecond));
  const networkTx = sum(aggregateInterfaces.map(item => item.txBytesPerSecond));
  const networkRxTotal = sum(aggregateInterfaces.map(item => item.rxTotalBytes));
  const networkTxTotal = sum(aggregateInterfaces.map(item => item.txTotalBytes));

  return {
    serverId: rawSystem.hostname || os.hostname(),
    timestamp,
    online: true,
    lastSeen: timestamp,

    cpu: {
      usagePercent: cpuUsage,
      temperatureC: cpuTemperature ? number(cpuTemperature.temperature_c) : null,
      frequencyGhz: (() => {
        const values = rawSystem.cpu?.frequencies_mhz || [];
        return values.length ? sum(values) / values.length / 1000 : null;
      })(),
      loadAverage: rawSystem.load_average
        ? [rawSystem.load_average['1m'], rawSystem.load_average['5m'], rawSystem.load_average['15m']]
        : undefined,
      processCount: processTotal,
      perCore,
      perThread: rawThreads
    },

    gpu: rawGpu ? {
      model: rawGpu.model,
      usagePercent: number(rawGpu.gpu_utilization_percent),
      temperatureC: gpuTemperature,
      vramTotalBytes: (rawGpu.vram_total_mib || 0) * 1048576,
      vramUsedBytes: (rawGpu.vram_used_mib || 0) * 1048576,
      memoryUtilizationPercent: number(rawGpu.memory_utilization_percent),
      coreClockMhz: number(rawGpu.graphics_clock_mhz),
      memoryClockMhz: number(rawGpu.memory_clock_mhz),
      powerWatts: number(rawGpu.power_watts),
      fanPercent: number(rawGpu.fan_percent)
    } : null,

    memory: {
      totalBytes: memoryTotal,
      usedBytes: memoryUsed,
      availableBytes: number(rawMemory.available),
      cachedBytes: number(rawMemory.cached),
      buffersBytes: number(rawMemory.buffers),
      freeBytes: number(rawMemory.free),
      swapTotalBytes: number(rawMemory.swap?.total),
      swapUsedBytes: number(rawMemory.swap?.used),
      utilizationPercent: number(rawMemory.usage_percent)
    },

    thermal: {
      sensors: thermalSensors,
      fans
    },

    storage: { devices: storage },

    wireguard: {
      status: rawWireGuard.status || 'warming_up',
      interfaces: (rawWireGuard.interfaces || []).map(item => ({
        name: item.name,
        listeningPort: item.listening_port,
        peerCount: item.peer_count,
        peers: (item.peers || []).map(peer => ({
          latestHandshakeSecondsAgo: peer.latest_handshake_seconds_ago,
          transfer: {
            receivedBytes: peer.transfer?.received_bytes ??
              peer.received_bytes ?? peer.transfer_rx_bytes ?? null,
            sentBytes: peer.transfer?.sent_bytes ??
              peer.sent_bytes ?? peer.transfer_tx_bytes ?? null
          }
        }))
      }))
    },

    tailscale: {
      status: rawTailscale.status || 'warming_up',
      backendState: rawTailscale.backend_state || null,
      selfOnline: rawTailscale.self_online ?? null,
      peerCount: rawTailscale.peer_count ?? null,
      onlinePeers: rawTailscale.online_peers ?? null,
      offlinePeers: rawTailscale.offline_peers ?? null
    },

    smart: {
      status: rawSmart.status || 'warming_up',
      devices: (rawSmart.devices || [])
        .filter((item, index, all) =>
          all.findIndex(other => other.device === item.device) === index)
        .map(item => ({
          device: item.device,
          model: item.model ?? null,
          health: item.health ?? null,
        status: item.error ? 'unavailable' : (item.health ? 'ok' : 'unknown'),
        error: item.error || null,
          temperatureC: number(smartField(item, [
            "temperature_c", "temperature", "temp", "current_temperature"
          ])),
          powerOnHours: number(smartField(item, [
            "power_on_hours", "power_on_hours_raw", "power_on_time",
            "hours", "poweronhours"
          ])),
          reallocatedSectors: number(smartField(item, [
            "reallocated_sectors", "reallocated_sector_ct",
            "reallocated_sector_count", "reallocated"
          ])),
          pendingSectors: number(smartField(item, [
            "pending_sectors", "current_pending_sector",
            "current_pending_sectors", "pending_sector_count"
          ])),
          offlineUncorrectable: number(smartField(item, [
            "offline_uncorrectable", "offline_uncorrectable_sector_ct",
            "offline_uncorrectable_sectors"
          ])),
          udmaCrcErrors: number(smartField(item, [
            "udma_crc_errors", "udma_crc_error_count",
            "udma_crc_error", "crc_errors"
          ])),
          nvmePercentageUsed: number(smartField(item, [
            "nvme_percentage_used", "percentage_used"
          ])),
          nvmeAvailableSparePercent: number(smartField(item, [
            "nvme_available_spare_percent", "available_spare"
          ])),
          nvmeCriticalWarning: smartField(item, [
            "nvme_critical_warning", "critical_warning"
          ]) ?? null,
          nvmeMediaDataIntegrityErrors: number(smartField(item, [
            "nvme_media_data_integrity_errors", "media_errors"
          ])),
          nvmeErrorInformationLogEntries: number(smartField(item, [
            "nvme_error_information_log_entries", "num_err_log_entries"
          ]))
        }))
    },

    network: {
      rxBytesPerSecond: networkRx,
      txBytesPerSecond: networkTx,
      rxTotalBytes: networkRxTotal,
      txTotalBytes: networkTxTotal,
      interfaces
    },

    processes: {
      cpu: processList,
      gpu: gpuProcesses
    },

    system: {
      hostname: rawSystem.hostname || os.hostname(),
      os: rawSystem.operating_system || 'Linux',
      osVersion: rawSystem.operating_system || undefined,
      kernel: rawSystem.kernel || os.release(),
      arch: archName(rawSystem.architecture || os.arch()),
      uptimeSeconds: uptime,
      bootTime: uptime === null ? undefined :
        new Date(Date.now() - uptime * 1000).toISOString(),
      processCount: processTotal,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  };
}

function buildHistory(records, seconds = 120) {
  const cutoff = Date.now() - seconds * 1000;
  const selected = records.filter(record =>
    Date.parse(record.timestamp) >= cutoff
  );

  const snapshots = selected.map(buildSnapshot);

  const series = {
    cpuPercent: snapshots.map(item => item.cpu.usagePercent),
    gpuPercent: snapshots.map(item => item.gpu ? item.gpu.usagePercent : null),
    memoryPercent: snapshots.map(item => item.memory.utilizationPercent),
    cpuTempC: snapshots.map(item => item.cpu.temperatureC),
    gpuTempC: snapshots.map(item => item.gpu ? item.gpu.temperatureC : null),
    rxBytesPerSecond: snapshots.map(item => item.network.rxBytesPerSecond),
    txBytesPerSecond: snapshots.map(item => item.network.txBytesPerSecond),
    diskReadBytesPerSecond: snapshots.map(item =>
      sum(item.storage.devices.map(device => device.readBytesPerSecond))
    ),
    diskWriteBytesPerSecond: snapshots.map(item =>
      sum(item.storage.devices.map(device => device.writeBytesPerSecond))
    )
  };

  return {
    timestamps: snapshots.map(item => item.timestamp),
    series
  };
}

module.exports = { buildHost, buildSnapshot, buildHistory };
