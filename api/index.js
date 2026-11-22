const express = require('express');
const {
  startCollector, getLatest, getHistory, SAMPLE_INTERVAL_MS
} = require('./collector');
const {
  buildHost, buildSnapshot, buildHistory
} = require('./api-contract');

const app = express();
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 43871);

app.disable('x-powered-by');
app.set('trust proxy', false);

const rateBuckets = new Map();
const RATE_WINDOW_MS = 60000;
const RATE_MAX = 120;

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.sendStatus(204);

  if (req.method !== 'GET') {
    res.set('Allow', 'GET, OPTIONS');
    return res.status(405).json({
      status: 'error',
      error: 'GET only'
    });
  }

  res.setTimeout(5000, () => res.destroy());

  const ip = req.socket.remoteAddress || 'unknown';
  const loopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

  // Local consumers (dashboard proxy, local tooling) are never throttled.
  if (loopback) return next();

  const now = Date.now();
  let bucket = rateBuckets.get(ip);

  if (!bucket || now - bucket.start >= RATE_WINDOW_MS) {
    bucket = { start: now, count: 0 };
    rateBuckets.set(ip, bucket);
  }

  bucket.count++;

  if (rateBuckets.size > 1000) {
    for (const [key, value] of rateBuckets) {
      if (now - value.start >= RATE_WINDOW_MS) rateBuckets.delete(key);
    }
  }

  if (bucket.count > RATE_MAX) {
    return res.status(429).json({
      status: 'error',
      error: 'Rate limit exceeded'
    });
  }

  next();
});

let hostCache = null;
let hostCacheAt = 0;

const streamClients = new Set();
let lastStreamTimestamp = null;

function buildLiveSnapshot() {
  const data = getLatest();

  if (!data.system || data.system.status === 'warming_up') {
    return null;
  }

  const samples = getHistory(1);
  const sample = samples[samples.length - 1] || data;

  return buildSnapshot({
    ...sample,
    timestamp: sample.timestamp || new Date().toISOString()
  });
}

app.get('/', (req, res) => {
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const base = `${protocol}://${req.get('host')}`;

  res.json({
    service: 'telemetry-api',
    version: '1',
    description: 'Read-only Linux monitoring API',
    authentication: 'none',
    methods: ['GET'],
    documentation: {
      apiIndex: `${base}/api-index.json`,
      openapi: `${base}/openapi.json`
    },
    endpoints: [
      { name: 'API directory', path: '/', url: `${base}/` },
      { name: 'Machine-readable API index', path: '/api-index.json', url: `${base}/api-index.json` },
      { name: 'OpenAPI specification', path: '/openapi.json', url: `${base}/openapi.json` },
      { name: 'Health', path: '/api/v1/health', url: `${base}/api/v1/health` },
      { name: 'Host information', path: '/api/v1/host', url: `${base}/api/v1/host` },
      { name: 'Live snapshot', path: '/api/v1/snapshot', url: `${base}/api/v1/snapshot` },
      { name: 'Live stream (SSE)', path: '/api/v1/stream', url: `${base}/api/v1/stream` },
      { name: 'Recent history', path: '/api/v1/history?seconds=120', url: `${base}/api/v1/history?seconds=120` }
    ],
    historyRetention: 'Up to 120 seconds, in memory; resets when API restarts'
  });
});

app.get('/api/v1/host', (req, res) => {
  const data = getLatest();

  if (!data.system || data.system.status === 'warming_up') {
    return res.status(503).json({ status: 'warming_up' });
  }

  if (!hostCache || Date.now() - hostCacheAt > 30000) {
    hostCache = buildHost(data);
    hostCacheAt = Date.now();
  }
  res.json(hostCache);
});

app.get('/api/v1/snapshot', (req, res) => {
  const snapshot = buildLiveSnapshot();

  if (!snapshot) {
    return res.status(503).json({
      status: 'warming_up',
      online: true
    });
  }

  res.json(snapshot);
});

app.get('/api/v1/stream', (req, res) => {
  res.setTimeout(0);
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();
  res.write(': connected\n\n');

  const initial = buildLiveSnapshot();
  if (initial) res.write(`data: ${JSON.stringify(initial)}\n\n`);

  streamClients.add(res);

  const keepAlive = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      streamClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    streamClients.delete(res);
  });
});

const streamTimer = setInterval(() => {
  if (streamClients.size === 0) return;

  const snapshot = buildLiveSnapshot();
  if (!snapshot || snapshot.timestamp === lastStreamTimestamp) return;

  lastStreamTimestamp = snapshot.timestamp;
  const frame = `data: ${JSON.stringify(snapshot)}\n\n`;

  for (const client of streamClients) {
    try {
      client.write(frame);
    } catch {
      streamClients.delete(client);
    }
  }
}, Math.max(250, SAMPLE_INTERVAL_MS));
streamTimer.unref();

app.get('/api/v1/history', (req, res) => {
  const raw = req.query.seconds === undefined
    ? '120' : String(req.query.seconds);

  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 120) {
    return res.status(400).json({
      status: 'error',
      error: 'seconds must be an integer from 1 to 120'
    });
  }

  res.json(buildHistory(getHistory(600), Number(raw)));
});

app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'telemetry-api',
    timestamp: new Date().toISOString()
  });
});

require('./discovery')(app);

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    error: 'Endpoint not found'
  });
});

startCollector();
app.listen(PORT, HOST, () => {
  console.log(`Monitoring API listening on http://${HOST}:${PORT}`);
  console.log('API endpoints: /, /api/v1/health, /api/v1/host, /api/v1/snapshot, /api/v1/stream, /api/v1/history');
  console.log('Access: unauthenticated HTTP; GET only; listening on all interfaces');
});
