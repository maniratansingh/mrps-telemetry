const fs = require('node:fs/promises');
const os = require('node:os');

async function collectSystem() {
  try {
    const [release, uptime, load, cpuinfo] = await Promise.all([
      fs.readFile('/etc/os-release', 'utf8'),
      fs.readFile('/proc/uptime', 'utf8'),
      fs.readFile('/proc/loadavg', 'utf8'),
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

    const frequencies = os.cpus().map(cpu => cpu.speed);
    const up = Number(uptime.split(/\s+/)[0]);
    const loads = load.trim().split(/\s+/).slice(0, 3).map(Number);

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      source: ['/etc/os-release', '/proc/uptime', '/proc/loadavg', '/proc/cpuinfo'],
      hostname: os.hostname(),
      operating_system: fields.PRETTY_NAME || null,
      kernel: os.release(),
      architecture: os.arch(),
      uptime_seconds: up,
      load_average: { '1m': loads[0], '5m': loads[1], '15m': loads[2] },
      cpu: {
        model: model ? model[1].trim() : null,
        logical_threads: os.cpus().length,
        physical_cores: cores.size || null,
        sockets: physical.size || null,
        frequencies_mhz: frequencies
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
