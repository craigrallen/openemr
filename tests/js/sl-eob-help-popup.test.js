'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('OPEMR-97 SL EOB help source contracts all pass', () => {
    const contract = path.join(__dirname, 'contracts/sl-eob-help-popup.cjs');
    const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', contract], {
        cwd: path.resolve(__dirname, '../..'),
        encoding: 'utf8'
    });
    expect(run.error).toBeUndefined();
    expect(run.signal).toBeNull();
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/^TAP version 13$/m);
    expect(run.stdout).toContain('synthetic future SL EOB candidate satisfies seven exact paired screen rules');
    expect(run.stdout).toContain('live SL EOB help has exact two-addition palette seam');
    expect(run.stdout).not.toMatch(/^not ok /m);
    const summary = [...run.stdout.matchAll(/^# tests (\d+)$/gm)];
    const passes = [...run.stdout.matchAll(/^# pass (\d+)$/gm)];
    const failures = [...run.stdout.matchAll(/^# fail (\d+)$/gm)];
    expect(summary).toHaveLength(1);
    expect(passes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(Number(summary[0][1])).toBe(9);
    expect(Number(passes[0][1])).toBe(9);
    expect(Number(failures[0][1])).toBe(0);
});
