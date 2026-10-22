'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('AMC help popup source contracts', () => {
    const contract = path.join(__dirname, 'contracts/cqm-amc-help-popup.cjs');
    const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', contract], {
        cwd: path.resolve(__dirname, '../..'),
        encoding: 'utf8'
    });
    expect(run.error).toBeUndefined();
    expect(run.signal).toBeNull();
    expect(run.stdout).toContain('TAP version 13');
    expect(run.stdout).toContain('synthetic full-original candidate passes before live RED');
    expect(run.stdout).toContain('live route has the exact AMC presentation seam');
    expect((run.stdout.match(/^\s*# Subtest:/gm) || []).length).toBeGreaterThan(0);
    const tests = run.stdout.match(/^# tests (\d+)$/m);
    const passed = run.stdout.match(/^# pass (\d+)$/m);
    const failed = run.stdout.match(/^# fail (\d+)$/m);
    expect(tests).not.toBeNull();
    expect(passed).not.toBeNull();
    expect(failed).not.toBeNull();
    expect(Number(tests[1])).toBeGreaterThan(0);
    expect(Number(passed[1])).toBe(Number(tests[1]));
    expect(Number(failed[1])).toBe(0);
    expect(run.status).toBe(0);
});
