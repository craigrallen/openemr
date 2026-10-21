/** @jest-environment node */
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('portable UB04 presentation contract emits TAP and is green', () => {
    const suite = path.resolve(__dirname, '../clinical-ui/ub04-form-popup.cjs');
    const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', suite], { encoding: 'utf8', timeout: 30000 });
    expect(run.error).toBeUndefined();
    expect(run.stdout).toMatch(/^TAP version 13/m);
    expect(run.stdout).toMatch(/^# tests \d+$/m);
    expect(run.stdout).toMatch(/^# fail 0$/m);
    expect(run.status).toBe(0);
});
