const { collectCpu } = require('./collectors/cpu');
const { collectMemory } = require('./collectors/memory');
const { collectSystem } = require('./collectors/system');
const { collectGpu } = require('./collectors/gpu');
const { collectThermal } = require('./collectors/thermal');
const { collectStorage } = require('./collectors/storage');
const { collectDisk } = require('./collectors/disk');
const { collectNetwork } = require('./collectors/network');
const { collectProcesses } = require('./collectors/processes');
const { collectSmart } = require('./collectors/smart');
const { collectWireGuard } = require('./collectors/wireguard');
const { collectTailscale } = require('./collectors/tailscale');

const SAMPLE_INTERVAL_MS = Math.min(5000, Math.max(250, Number(process.env.SAMPLE_INTERVAL_MS || 500)));
const INTERVAL = SAMPLE_INTERVAL_MS;
const HISTORY_LIMIT = Math.ceil(120000 / INTERVAL) + 5;
const HISTORY_MAX_AGE_MS = 120000;

const latest = {
  cpu: { status: 'warming_up' },
  memory: { status: 'warming_up' },
  system: { status: 'warming_up' },
  gpu: { status: 'warming_up' },
  thermal: { status: 'warming_up' },
  storage: { status: 'warming_up' },
  disk: { status: 'warming_up' },
  network: { status: 'warming_up' },
  processes: { status: 'warming_up' },
  smart: { status: 'warming_up' },
  wireguard: { status: 'warming_up' },
  tailscale: { status: 'warming_up' }
};

const history = [];
const lastRun = {};
const running = {};
let collecting = false;
let started = false;

const jobs = {
  gpu: { interval: 5000, fn: collectGpu },
  thermal: { interval: 5000, fn: collectThermal },
  storage: { interval: 15000, fn: collectStorage },
  disk: { interval: 1000, fn: collectDisk },
  network: { interval: 1000, fn: collectNetwork },
  processes: { interval: 5000, fn: collectProcesses },
  smart: { interval: 60000, fn: collectSmart },
  wireguard: { interval: 15000, fn: collectWireGuard },
  tailscale: { interval: 15000, fn: collectTailscale }
};

async function safeRun(fn, name) {
  try {
    return await fn();
  } catch (error) {
    return {
      status: 'unavailable',
      source: name,
      error: error.message
    };
  }
}

async function runJob(name, job) {
  if (running[name]) return;
  running[name] = true;
  lastRun[name] = Date.now();

  try {
    const result = await safeRun(job.fn, name);
    result.collectedAt = new Date().toISOString();

    if (result.status === 'ok' || result.status === 'partial' ||
        latest[name].status === 'warming_up') {
      latest[name] = result;
    } else {
      latest[name] = {
        ...latest[name],
        status: 'stale',
        lastError: result.error || result.message || 'Latest collection unavailable'
      };
    }
  } finally {
    running[name] = false;
  }
}

async function collect() {
  if (collecting) return;
  collecting = true;

  try {
    const [cpu, memory, system] = await Promise.all([
      safeRun(collectCpu, 'cpu'),
      safeRun(collectMemory, 'memory'),
      safeRun(collectSystem, 'system')
    ]);

    for (const [name, result] of Object.entries({ cpu, memory, system })) {
      result.collectedAt = new Date().toISOString();
      if (result.status === 'ok' || result.status === 'partial' ||
          latest[name].status === 'warming_up') {
        latest[name] = result;
      } else {
        latest[name] = {
          ...latest[name],
          status: 'stale',
          lastError: result.error || result.message || 'Latest collection unavailable'
        };
      }
    }

    const now = Date.now();

    for (const [name, job] of Object.entries(jobs)) {
      if (!lastRun[name] || now - lastRun[name] >= job.interval) {
        runJob(name, job).catch(error => {
          console.error(`Collector ${name}:`, error.message);
        });
      }
    }

    // Sections are replaced wholesale by the collectors, never mutated, so a
    // shallow record is immutable and avoids a full deep clone twice a second.
    const record = {
      timestamp: new Date().toISOString(),
      ...latest
    };

    history.push(record);

    const cutoff = Date.now() - HISTORY_MAX_AGE_MS;
    while (history.length &&
      (history.length > HISTORY_LIMIT ||
       Date.parse(history[0].timestamp) < cutoff)) {
      history.shift();
    }
  } catch (error) {
    console.error('Collection error:', error.message);
  } finally {
    collecting = false;
  }
}

function startCollector() {
  if (started) return;
  started = true;

  collect().catch(error => console.error(error.message));

  const timer = setInterval(() => {
    collect().catch(error => console.error(error.message));
  }, INTERVAL);

  timer.unref();
}

function getLatest() {
  return { ...latest };
}

function getHistory(limit = 120) {
  return history.slice(-limit);
}

module.exports = { startCollector, getLatest, getHistory, SAMPLE_INTERVAL_MS };
