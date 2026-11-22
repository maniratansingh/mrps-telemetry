const fs = require('node:fs');
const path = require('node:path');

let previous = null;

function readNumber(file) {
  try {
    const value = Number(fs.readFileSync(file, 'utf8').trim());
    return Number.isFinite(value) ? value : null;
  } catch { return null; }
}

function collectNetwork() {
  const now = Date.now();
  let interfaces;
  try { interfaces = fs.readdirSync('/sys/class/net'); }
  catch (error) {
    return { status: 'unavailable', error: error.message, interfaces: [] };
  }

  const current = {};
  for (const name of interfaces) {
    const base = path.join('/sys/class/net', name);
    const stats = path.join(base, 'statistics');
    const read = key => readNumber(path.join(stats, key));

    current[name] = {
      state: (() => {
        try { return fs.readFileSync(path.join(base, 'operstate'), 'utf8').trim(); }
        catch { return 'unknown'; }
      })(),
      rx_bytes: read('rx_bytes'),
      tx_bytes: read('tx_bytes'),
      rx_packets: read('rx_packets'),
      tx_packets: read('tx_packets'),
      rx_errors: read('rx_errors'),
      tx_errors: read('tx_errors'),
      rx_dropped: read('rx_dropped'),
      tx_dropped: read('tx_dropped')
    };
  }

  const elapsed = previous ? (now - previous.time) / 1000 : 0;
  const result = Object.entries(current).map(([name, value]) => {
    const old = previous && previous.interfaces[name];
    const rate = (key) => old && elapsed > 0 &&
      value[key] !== null && old[key] !== null
      ? Math.max(0, (value[key] - old[key]) / elapsed) : null;

    return {
      name, ...value,
      rx_bytes_per_sec: rate('rx_bytes'),
      tx_bytes_per_sec: rate('tx_bytes'),
      rx_packets_per_sec: rate('rx_packets'),
      tx_packets_per_sec: rate('tx_packets')
    };
  });

  previous = { time: now, interfaces: current };
  return {
    status: 'ok', source: '/sys/class/net',
    interval_seconds: elapsed || null, interfaces: result
  };
}

module.exports = { collectNetwork };
