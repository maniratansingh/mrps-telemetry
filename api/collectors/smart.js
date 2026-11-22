const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);

function parseSmart(output) {
  const sections = output.split(
    /(?=^={2,}\s*\/dev\/(?:nvme\d+n\d+|sd[a-z]+|hd[a-z]+|vd[a-z]+)\s*={2,}\s*$)/im
  );
  const devices = [];
  const seen = new Set();

  for (const section of sections) {
    const pathMatch = section.match(
      /\/dev\/(?:nvme\d+n\d+|sd[a-z]+|hd[a-z]+|vd[a-z]+)/i
    );
    if (!pathMatch) continue;

    const devicePath = pathMatch[0];
    if (seen.has(devicePath)) continue;
    seen.add(devicePath);

    const get = regex => {
      const match = section.match(regex);
      return match ? match[1].trim() : null;
    };

    const attr = name => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const line = section.split(/\r?\n/).find(row =>
        new RegExp('^\\s*\\d+\\s+' + escaped + '\\s+', 'i').test(row)
      );
      if (!line) return null;

      // SMART attribute RAW_VALUE follows the WHEN_FAILED column.
      const match = line.match(/\s-\s+(-?\d+)/);
      return match ? Number(match[1]) : null;
    };

    const model = get(/^(?:Device Model|Model Number|Product):\s*(.+)$/im);
    const health =
      get(/^SMART overall-health self-assessment test result:\s*(.+)$/im) ||
      get(/^SMART Health Status:\s*(.+)$/im);

    const error = get(/^Smartctl open device:.*failed:\s*(.+)$/im);

    const temperature =
      attr('Temperature_Celsius') ??
      attr('Airflow_Temperature_Cel') ??
      (() => {
        const value = get(/^(?:Temperature|Temperature Sensor 1):\s*(\d+)/im);
        return value === null ? null : Number(value);
      })();

    const powerHours =
      attr('Power_On_Hours') ??
      (() => {
        const value = get(/^Power on Hours:\s*(\d+)/im);
        return value === null ? null : Number(value);
      })();

    devices.push({
      device: devicePath,
      model,
      health: health || null,
      error,
      temperature_c: temperature,
      power_on_hours: powerHours,
      reallocated_sectors: attr('Reallocated_Sector_Ct'),
      pending_sectors: attr('Current_Pending_Sector'),
      offline_uncorrectable: attr('Offline_Uncorrectable'),
      udma_crc_errors: attr('UDMA_CRC_Error_Count'),
      nvme_percentage_used: (() => {
        const v = get(/^Percentage Used:\s*(\d+)%?/im);
        return v === null ? null : Number(v);
      })(),
      nvme_available_spare_percent: (() => {
        const v = get(/^Available Spare:\s*(\d+)%?/im);
        return v === null ? null : Number(v);
      })(),
      nvme_critical_warning: get(/^Critical Warning:\s*(0x[0-9a-f]+)/im),
      nvme_media_data_integrity_errors: (() => {
        const v = get(/^Media and Data Integrity Errors:\s*(\d+)/im);
        return v === null ? null : Number(v);
      })(),
      nvme_error_information_log_entries: (() => {
        const v = get(/^Error Information Log Entries:\s*(\d+)/im);
        return v === null ? null : Number(v);
      })()
    });
  }

  return devices;
}

async function collectSmart() {
  try {
    const { stdout, stderr } = await run('/usr/bin/sudo', [
      '-n', '/usr/local/sbin/monitor-smart'
    ], {
      timeout: 20000,
      maxBuffer: 4 * 1024 * 1024,
      encoding: 'utf8'
    });

    const devices = parseSmart(stdout || '');
    return {
      status: devices.some(d => d.health) ? 'ok' : 'unavailable',
      source: 'monitor-smart',
      devices,
      message: devices.length ? undefined :
        ((stderr || '').trim() || 'No recognizable SMART device sections')
    };
  } catch (error) {
    const devices = parseSmart(error.stdout || '');
    if (devices.length) {
      return {
        status: 'partial',
        source: 'monitor-smart',
        devices,
        message: 'SMART command returned a non-zero exit status'
      };
    }
    return {
      status: 'unavailable',
      source: 'monitor-smart',
      devices: [],
      error: error.message
    };
  }
}

module.exports = { collectSmart };
