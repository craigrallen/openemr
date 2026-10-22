'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Transactions help popup source contracts all pass', () => {
    const contract = path.join(__dirname, 'contracts/transactions-dashboard-help-popup.cjs');
    const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', contract], {
        cwd: path.resolve(__dirname, '../..'),
        encoding: 'utf8'
    });
    expect(run.error).toBeUndefined();
    expect(run.signal).toBeNull();
    expect(run.stdout).toContain('TAP version 13');
    expect(run.stdout).toContain('full synthetic future Transactions candidate passes before the live RED assertion');
    expect(run.stdout).toContain('live route has the exact Transactions presentation seam');
    const summary = run.stdout.match(/^# tests (\d+)$/m);
    const passes = run.stdout.match(/^# pass (\d+)$/m);
    const failures = run.stdout.match(/^# fail (\d+)$/m);
    expect(summary).not.toBeNull();
    expect(passes).not.toBeNull();
    expect(failures).not.toBeNull();
    expect(Number(summary[1])).toBe(41);
    expect(Number(passes[1])).toBe(41);
    expect(Number(failures[1])).toBe(0);
    expect(run.status).toBe(0);
});
