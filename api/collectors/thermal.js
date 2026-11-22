const fs = require('node:fs');
const path = require('node:path');

function read(file) {
  try { return fs.readFileSync(file, 'utf8').trim(); }
  catch { return null; }
}

async function collectThermal() {
  const sensors = [];
  const roots = ['/sys/class/hwmon', '/sys/class/thermal'];

  for (const root of roots) {
    let entries = [];
    try { entries = fs.readdirSync(root); } catch { continue; }

    for (const entry of entries) {
      const base = path.join(root, entry);

      if (root.endsWith('hwmon')) {
        const chip = read(path.join(base, 'name')) || entry;
        let files = [];
        try { files = fs.readdirSync(base); } catch { continue; }

        for (const file of files) {
          let match = file.match(/^temp(\d+)_input$/);
          if (match) {
            const rawText = read(path.join(base, file));
            const raw = rawText === null ? NaN : Number(rawText);
            if (Number.isFinite(raw)) {
              const label = read(path.join(base, `temp${match[1]}_label`));
              sensors.push({
                chip, sensor: label || `temp${match[1]}`,
                temperature_c: Math.round(raw / 100) / 10
              });
            }
          }

          match = file.match(/^fan(\d+)_input$/);
          if (match) {
            const rpmText = read(path.join(base, file));
            const rpm = rpmText === null ? NaN : Number(rpmText);
            if (Number.isFinite(rpm)) {
              sensors.push({
                chip, sensor: `fan${match[1]}`,
                fan_rpm: rpm
              });
            }
          }
        }
      } else {
        if (!/^thermal_zone\d+$/.test(entry)) continue;
        const rawText = read(path.join(base, 'temp'));
        const raw = rawText === null ? NaN : Number(rawText);
        if (!Number.isFinite(raw)) continue;
        sensors.push({
          chip: 'thermal_zone',
          sensor: read(path.join(base, 'type')) || entry,
          temperature_c: Math.round(raw / 100) / 10
        });
      }
    }
  }

  const unique = [];
  const seen = new Set();
  for (const item of sensors) {
    const key = `${item.chip}:${item.sensor}`;
    if (!seen.has(key)) { seen.add(key); unique.push(item); }
  }

  return {
    status: unique.length ? 'ok' : 'unavailable',
    source: 'sysfs',
    sensors: unique,
    message: unique.length ? undefined : 'No readable thermal or fan sensors found'
  };
}

module.exports = { collectThermal };
