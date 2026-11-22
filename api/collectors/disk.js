const fs = require('node:fs');

let previous = null;

function collectDisk() {
  const now = Date.now();
  let content;
  try { content = fs.readFileSync('/proc/diskstats', 'utf8'); }
  catch (error) {
    return { status: 'unavailable', error: error.message, devices: [] };
  }

  const current = {};
  for (const line of content.trim().split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p.length < 14) continue;

    const name = p[2];
    if (/^(loop|ram)/.test(name)) continue;

    current[name] = {
      major: Number(p[0]), minor: Number(p[1]),
      reads_completed: Number(p[3]),
      sectors_read: Number(p[5]),
      read_time_ms: Number(p[6]),
      writes_completed: Number(p[7]),
      sectors_written: Number(p[9]),
      write_time_ms: Number(p[10]),
      io_in_progress: Number(p[11]),
      io_time_ms: Number(p[12]),
      weighted_io_time_ms: Number(p[13])
    };
  }

  const elapsed = previous ? (now - previous.time) / 1000 : 0;
  const devices = Object.entries(current).map(([name, value]) => {
    const old = previous && previous.devices[name];
    const readBytes = value.sectors_read * 512;
    const writeBytes = value.sectors_written * 512;
    const oldRead = old ? old.sectors_read * 512 : null;
    const oldWrite = old ? old.sectors_written * 512 : null;

    return {
      name,
      ...value,
      read_bytes: readBytes,
      write_bytes: writeBytes,
      read_bytes_per_sec: old && elapsed > 0
        ? Math.max(0, (readBytes - oldRead) / elapsed) : null,
      write_bytes_per_sec: old && elapsed > 0
        ? Math.max(0, (writeBytes - oldWrite) / elapsed) : null,
      reads_per_sec: old && elapsed > 0
        ? Math.max(0, (value.reads_completed - old.reads_completed) / elapsed) : null,
      writes_per_sec: old && elapsed > 0
        ? Math.max(0, (value.writes_completed - old.writes_completed) / elapsed) : null
    };
  });

  previous = { time: now, devices: current };
  return { status: 'ok', source: '/proc/diskstats', interval_seconds: elapsed || null, devices };
}

module.exports = { collectDisk };
