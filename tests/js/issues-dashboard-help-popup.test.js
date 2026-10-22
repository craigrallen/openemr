'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('OPEMR-93 Issues dashboard help popup portable source contracts all pass', () => {
    const contract = path.join(__dirname, 'contracts/issues-dashboard-help-popup.cjs');
    const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', contract], {
        cwd: path.resolve(__dirname, '../..'),
        encoding: 'utf8'
    });
    expect(run.error).toBeUndefined();
    expect(run.signal).toBeNull();
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/^TAP version 13\n/);
    expect(run.stdout).toContain('synthetic Issues dashboard presentation candidate satisfies the complete seam');
    expect(run.stdout).toContain('live Issues route has the exact approved presentation seam');
    const summary = run.stdout.match(/^# tests (\d+)$/gm);
    const passes = run.stdout.match(/^# pass (\d+)$/gm);
    const failures = run.stdout.match(/^# fail (\d+)$/gm);
    expect(summary).toEqual(['# tests 9']);
    expect(passes).toEqual(['# pass 9']);
    expect(failures).toEqual(['# fail 0']);
});
