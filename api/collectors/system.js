const fs = require('node:fs/promises');
const os = require('node:os');

let staticInfo = null;
let frequencyCache = { at: 0, values: [] };

async function loadStaticInfo() {
  const [release, cpuinfo] = await Promise.all([
    fs.readFile('/etc/os-release', 'utf8'),
    fs.readFile('/proc/cpuinfo', 'utf8')
  ]);

  const fields = {};
  for (const line of release.split('\n')) {
    const match = line.match(/^(\w+)="?([^"]*)"?$/);
    if (match) fields[match[1]] = match[2];
  }

  const model = cpuinfo.match(/^model name\s*:\s*(.+)$/m);
  const physical = new Set();
  const cores = new Set();

  for (const block of cpuinfo.split(/\n\n+/)) {
    const id = block.match(/^physical id\s*:\s*(\d+)/m);
    const core = block.match(/^core id\s*:\s*(\d+)/m);
    if (id && core) {
      physical.add(id[1]);
      cores.add(`${id[1]}:${core[1]}`);
    }
  }

  staticInfo = {
    hostname: os.hostname(),
    operating_system: fields.PRETTY_NAME || null,
    kernel: os.release(),
    architecture: os.arch(),
    model: model ? model[1].trim() : null,
    logical_threads: os.cpus().length,
    physical_cores: cores.size || null,
    sockets: physical.size || null
  };

  return staticInfo;
}

async function collectSystem() {
  try {
    const [uptime, load] = await Promise.all([
      fs.readFile('/proc/uptime', 'utf8'),
      fs.readFile('/proc/loadavg', 'utf8')
    ]);

    const info = staticInfo || await loadStaticInfo();

    // CPU frequency is the only value here that changes; refresh it at 2 s
    // instead of parsing /proc/cpuinfo and calling os.cpus() every tick.
    if (Date.now() - frequencyCache.at > 2000) {
      frequencyCache = {
        at: Date.now(),
        values: os.cpus().map(cpu => cpu.speed)
      };
    }

    const up = Number(uptime.split(/\s+/)[0]);
    const loads = load.trim().split(/\s+/).slice(0, 3).map(Number);

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      source: ['/proc/uptime', '/proc/loadavg', '/etc/os-release', '/proc/cpuinfo'],
      hostname: info.hostname,
      operating_system: info.operating_system,
      kernel: info.kernel,
      architecture: info.architecture,
      uptime_seconds: up,
      load_average: { '1m': loads[0], '5m': loads[1], '15m': loads[2] },
      cpu: {
        model: info.model,
        logical_threads: info.logical_threads,
        physical_cores: info.physical_cores,
        sockets: info.sockets,
        frequencies_mhz: frequencyCache.values
      }
    };
  } catch (error) {
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      source: '/proc and /etc/os-release',
      error: error.message
    };
  }
}

module.exports = { collectSystem };
