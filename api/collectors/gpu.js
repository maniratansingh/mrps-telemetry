const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execute = promisify(execFile);

function number(value) {
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

async function collectGpu() {
  const source = 'nvidia-smi';

  try {
    const args = [
      '--query-gpu=name,driver_version,utilization.gpu,utilization.memory,memory.total,memory.used,memory.free,temperature.gpu,fan.speed,power.draw,clocks.gr,clocks.mem',
      '--format=csv,noheader,nounits'
    ];

    const { stdout } = await execute('nvidia-smi', args, {
      timeout: 4000,
      maxBuffer: 1024 * 1024,
      windowsHide: true
    });

    const fields = stdout.trim().split('\n')[0].split(',').map(v => v.trim());

    if (fields.length < 12) throw new Error('Unexpected nvidia-smi output');

    const names = [
      'model', 'driver_version', 'gpu_utilization_percent',
      'memory_utilization_percent', 'vram_total_mib', 'vram_used_mib',
      'vram_free_mib', 'temperature_celsius', 'fan_percent',
      'power_watts', 'graphics_clock_mhz', 'memory_clock_mhz'
    ];

    const gpu = {};
    names.forEach((name, index) => {
      gpu[name] = index < 2 ? fields[index] : number(fields[index]);
    });

    let processes = { status: 'unavailable', data: [] };

    try {
      const result = await execute('nvidia-smi', [
        '--query-compute-apps=pid,process_name,used_memory',
        '--format=csv,noheader,nounits'
      ], { timeout: 4000, maxBuffer: 1024 * 1024 });

      processes = {
        status: 'ok',
        data: result.stdout.trim()
          ? result.stdout.trim().split('\n').map(line => {
              const p = line.split(',').map(v => v.trim());
              return {
                pid: number(p[0]),
                process_name: p[1] || null,
                memory_mib: number(p[2])
              };
            })
          : []
      };
    } catch (error) {
      processes = { status: 'error', data: [], error: error.message };
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      source,
      unit: { temperature: 'celsius', power: 'watts', memory: 'MiB', clocks: 'MHz' },
      gpu,
      processes
    };
  } catch (error) {
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      source,
      error: error.message
    };
  }
}

module.exports = { collectGpu };
