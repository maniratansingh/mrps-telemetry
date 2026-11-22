const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);

async function command(file, args, timeout = 8000) {
  try {
    const result = await run(file, args, {
      timeout, maxBuffer: 2 * 1024 * 1024,
      encoding: 'utf8', windowsHide: true
    });
    return { stdout: result.stdout || '', error: null };
  } catch (error) {
    return { stdout: error.stdout || '', error: error.message };
  }
}

async function collectStorage() {
  const [block, filesystems] = await Promise.all([
    command('/usr/bin/lsblk', [
      '-J', '-b', '-o',
      'NAME,KNAME,TYPE,SIZE,MODEL,TRAN,ROTA,FSTYPE,MOUNTPOINTS'
    ]),
    command('/usr/bin/df', ['-PT', '-B1'])
  ]);

  let devices = [];
  let blockError = block.error;

  if (block.stdout) {
    try {
      const parsed = JSON.parse(block.stdout);
      const flatten = (items, parent = null) => {
        for (const item of items || []) {
          devices.push({
            name: item.name || null,
            kernel_name: item.kname || null,
            type: item.type || null,
            parent,
            size_bytes: Number(item.size) || 0,
            model: item.model || null,
            transport: item.tran || null,
            rotational: item.rota === undefined ? null : Boolean(Number(item.rota)),
            filesystem: item.fstype || null,
            mountpoints: Array.isArray(item.mountpoints)
              ? item.mountpoints.filter(Boolean) : []
          });
          flatten(item.children, item.kname || item.name || null);
        }
      };
      flatten(parsed.blockdevices);
    } catch (error) {
      blockError = `Could not parse lsblk output: ${error.message}`;
    }
  }

  const mounts = [];
  const lines = filesystems.stdout.trim().split('\n').slice(1);
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 7) continue;
    mounts.push({
      filesystem: parts[0],
      type: parts[1],
      size_bytes: Number(parts[2]) || 0,
      used_bytes: Number(parts[3]) || 0,
      available_bytes: Number(parts[4]) || 0,
      used_percent: Number((parts[5] || '').replace('%', '')) || 0,
      mountpoint: parts.slice(6).join(' ')
    });
  }

  const ok = devices.length > 0 || mounts.length > 0;
  return {
    status: ok ? 'ok' : 'unavailable',
    devices,
    filesystems: mounts,
    errors: [
      blockError ? `lsblk: ${blockError}` : null,
      filesystems.error ? `df: ${filesystems.error}` : null
    ].filter(Boolean)
  };
}

module.exports = { collectStorage };
