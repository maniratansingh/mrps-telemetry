const fs = require('node:fs/promises');

let previous = null;

function parseCpuLine(line) {
  const values = line.trim().split(/\s+/);
  return {
    name: values.shift(),
    ticks: values.map(Number)
  };
}

function calculate(current, old) {
  if (!old) return null;

  const delta = current.ticks.map(
    (value, index) => Math.max(0, value - (old.ticks[index] || 0))
  );

  const total = delta.slice(0, 8).reduce((a, b) => a + b, 0);

  if (total === 0) return null;

  const percent = value => Number((value / total * 100).toFixed(2));

  const user = delta[0] || 0;
  const nice = delta[1] || 0;
  const system = delta[2] || 0;
  const idle = delta[3] || 0;
  const iowait = delta[4] || 0;
  const irq = delta[5] || 0;
  const softirq = delta[6] || 0;
  const steal = delta[7] || 0;

  return {
    usage_percent: percent(user + nice + system + irq + softirq + steal),
    user_percent: percent(user),
    nice_percent: percent(nice),
    system_percent: percent(system + irq + softirq),
    idle_percent: percent(idle),
    iowait_percent: percent(iowait),
    irq_percent: percent(irq),
    softirq_percent: percent(softirq),
    steal_percent: percent(steal)
  };
}

async function collectCpu() {
  try {
    const content = await fs.readFile('/proc/stat', 'utf8');

    const current = content.split('\n')
      .filter(line => /^cpu(?:\d+)?\s/.test(line))
      .map(parseCpuLine);

    const old = previous;
    previous = current;

    if (!current.length) {
      throw new Error('No CPU counters found');
    }

    const aggregate = calculate(current[0], old?.[0]);

    const cores = current.slice(1).map((cpu, index) => ({
      core: index,
      ...(
        calculate(cpu, old?.[index + 1]) || {
          status: 'warming_up',
          usage_percent: null
        }
      )
    }));

    return {
      status: aggregate ? 'ok' : 'warming_up',
      timestamp: new Date().toISOString(),
      source: '/proc/stat',
      unit: 'percent',
      aggregate,
      cores
    };
  } catch (error) {
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      source: '/proc/stat',
      error: error.message
    };
  }
}

module.exports = { collectCpu };
