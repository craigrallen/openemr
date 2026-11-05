/** @jest-environment node */

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('portable terminal payment presentation contract passes its complete TAP plan', () => {
    const contract = path.resolve(__dirname, '../clinical-ui/terminal-payment-popup-contract.cjs');
    const child = spawnSync(process.execPath, ['--test', '--test-reporter=tap', contract], {
        cwd: path.resolve(__dirname, '../..'),
        encoding: 'utf8',
    });
    if (child.error) throw child.error;
    const tap = child.stdout;
    expect(child.status).toBe(0);
    expect(child.signal).toBeNull();
    const plans = [...tap.matchAll(/^1\.\.(\d+)$/gm)];
    const summaries = key => [...tap.matchAll(new RegExp(`^# ${key} (\\d+)$`, 'gm'))];
    expect(plans).toHaveLength(1);
    const planned = Number(plans[0][1]);
    expect(planned).toBeGreaterThan(0);
    for (const key of ['tests', 'pass']) {
        const matches = summaries(key);
        expect(matches).toHaveLength(1);
        expect(Number(matches[0][1])).toBe(planned);
    }
    for (const key of ['fail', 'cancelled', 'skipped', 'todo']) {
        const matches = summaries(key);
        expect(matches).toHaveLength(1);
        expect(Number(matches[0][1])).toBe(0);
    }
    expect(tap).not.toMatch(/^not ok\b/m);
});
