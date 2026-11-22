const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);

function durationSeconds(text) {
  const units = { day: 86400, hour: 3600, minute: 60, second: 1 };
  let total = 0;
  for (const match of text.matchAll(/(\d+)\s+(day|hour|minute|second)s?/g)) {
    total += Number(match[1]) * units[match[2]];
  }
  return total;
}

function bytesFrom(text) {
  const match = text.match(
    /transfer:\s*([\d.]+)\s*(B|KiB|MiB|GiB)\s*received,\s*([\d.]+)\s*(B|KiB|MiB|GiB)\s*sent/i
  );
  if (!match) return null;
  const factor = { B: 1, KiB: 1024, MiB: 1048576, GiB: 1073741824 };
  return {
    received_bytes: Math.round(Number(match[1]) * factor[match[2]]),
    sent_bytes: Math.round(Number(match[3]) * factor[match[4]])
  };
}

async function collectWireGuard() {
  try {
    const { stdout } = await run('/usr/bin/sudo', [
      '-n', '/usr/bin/wg', 'show', 'all'
    ], { timeout: 5000, maxBuffer: 1024 * 1024, encoding: 'utf8' });

    const interfaces = [];
    let current = null;
    let peer = null;

    for (const line of stdout.split(/\r?\n/)) {
      let m;
      if ((m = line.match(/^interface:\s*(\S+)/))) {
        current = { name: m[1], listening_port: null, peers: [] };
        interfaces.push(current);
        peer = null;
      } else if ((m = line.match(/^\s+listening port:\s*(\d+)/)) && current) {
        current.listening_port = Number(m[1]);
      } else if (/^peer:\s*/.test(line) && current) {
        peer = {
          latest_handshake_seconds_ago: null,
          transfer: null
        };
        current.peers.push(peer);
      } else if ((m = line.match(/^\s+latest handshake:\s*(.+)$/)) && peer) {
        peer.latest_handshake_seconds_ago = durationSeconds(m[1]);
      } else if (peer && /^\s+transfer:/.test(line)) {
        peer.transfer = bytesFrom(line);
      }
    }

    return {
      status: 'ok',
      interfaces: interfaces.map(item => ({
        name: item.name,
        listening_port: item.listening_port,
        peer_count: item.peers.length,
        peers: item.peers
      }))
    };
  } catch (error) {
    return {
      status: 'unavailable',
      error: error.message,
      message: 'WireGuard data unavailable; existing sudo permission was not changed',
      interfaces: []
    };
  }
}

module.exports = { collectWireGuard };
