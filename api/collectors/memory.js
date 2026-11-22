const fs = require('node:fs/promises');

async function collectMemory() {
  try {
    const text = await fs.readFile('/proc/meminfo', 'utf8');
    const values = {};

    for (const line of text.split('\n')) {
      const match = line.match(/^(\w+):\s+(\d+)\s+kB/);
      if (match) values[match[1]] = Number(match[2]) * 1024;
    }

    const total = values.MemTotal;
    const available = values.MemAvailable;
    const swapTotal = values.SwapTotal;
    const swapFree = values.SwapFree;

    if (total === undefined || available === undefined)
      throw new Error('Required memory counters unavailable');

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      source: '/proc/meminfo',
      unit: 'bytes',
      total,
      available,
      free: values.MemFree,
      used: total - available,
      usage_percent: Number(((total - available) / total * 100).toFixed(2)),
      buffers: values.Buffers,
      cached: values.Cached,
      swap: {
        total: swapTotal,
        free: swapFree,
        used: swapTotal !== undefined && swapFree !== undefined
          ? swapTotal - swapFree : null,
        usage_percent: swapTotal > 0 && swapFree !== undefined
          ? Number(((swapTotal - swapFree) / swapTotal * 100).toFixed(2))
          : null
      }
    };
  } catch (error) {
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      source: '/proc/meminfo',
      error: error.message
    };
  }
}

module.exports = { collectMemory };
