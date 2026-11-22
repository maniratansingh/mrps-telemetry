const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);

async function collectProcesses() {
  try {
    const { stdout } = await run('/usr/bin/ps', [
      '-eo', 'pid=,comm=,pcpu=,pmem=,rss=',
      '--sort=-pcpu'
    ], { timeout: 4000, maxBuffer: 1024 * 1024, encoding: 'utf8' });

    const processes = stdout.trim().split('\n').slice(0, 15).map(line => {
      const p = line.trim().split(/\s+/);
      if (p.length < 5) return null;
      return {
        pid: Number(p[0]),
        name: p[1],
        cpu_percent: Number(p[2]),
        memory_percent: Number(p[3]),
        rss_bytes: Number(p[4]) * 1024
      };
    }).filter(Boolean);

    return { status: 'ok', source: 'ps', processes };
  } catch (error) {
    return { status: 'unavailable', error: error.message, processes: [] };
  }
}

module.exports = { collectProcesses };
