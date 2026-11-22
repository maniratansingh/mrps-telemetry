const fs = require('node:fs');
const path = require('node:path');

module.exports = function registerDiscovery(app) {
  const specPath = path.join(__dirname, 'openapi.json');

  app.get('/openapi.json', (req, res) => {
    res.type('application/json');
    res.send(fs.readFileSync(specPath, 'utf8'));
  });

  app.get('/api-index.json', (req, res) => {
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const base = `${protocol}://${req.get('host')}`;

    res.json({
      service: 'telemetry-api',
      version: '1',
      description: 'Read-only Linux monitoring API',
      baseUrl: base,
      authentication: 'none',
      methods: ['GET'],
      documentation: {
        openapi: '/openapi.json',
        openapiUrl: `${base}/openapi.json`,
        editableSource: 'openapi.json'
      },
      endpoints: [
        { name: 'API directory', path: '/', url: `${base}/` },
        { name: 'Health', path: '/api/v1/health', url: `${base}/api/v1/health` },
        { name: 'Host information', path: '/api/v1/host', url: `${base}/api/v1/host` },
        { name: 'Live snapshot', path: '/api/v1/snapshot', url: `${base}/api/v1/snapshot` },
        { name: 'Recent history', path: '/api/v1/history?seconds=120', url: `${base}/api/v1/history?seconds=120` }
      ],
      historyRetention: 'Up to 120 samples in memory; resets when API restarts.',
      collectors: [
        'CPU', 'Memory', 'System', 'NVIDIA GPU', 'Thermal',
        'Storage', 'Disk', 'Network', 'Processes',
        'SMART', 'WireGuard', 'Tailscale'
      ],
      instructions: 'Read openapi.json, then inspect snapshot and history responses to discover actual telemetry fields. Do not assume unavailable values are zero.'
    });
  });
};
