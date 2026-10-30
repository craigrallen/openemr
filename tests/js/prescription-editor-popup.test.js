/** @jest-environment node */
// Hosted adapter for the dependency-free portable contract.
const path = require('node:path');
const process = require('node:process');
const { spawnSync } = require('node:child_process');

test('prescription editor popup portable contract passes with a positive TAP plan', () => {
    const contract = path.resolve(__dirname, '../clinical-ui/prescription-editor-popup-contract.cjs');
    const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', contract], {
        cwd: path.resolve(__dirname, '../..'),
        encoding: 'utf8',
    });
    expect(run.error).toBeUndefined();
    expect(run.status).toBe(0);
    const plan = run.stdout.match(/^1\.\.(\d+)$/m);
    const tests = run.stdout.match(/^# tests (\d+)$/m);
    const passed = run.stdout.match(/^# pass (\d+)$/m);
    const failed = run.stdout.match(/^# fail (\d+)$/m);
    expect(plan).not.toBeNull();
    expect(tests).not.toBeNull();
    expect(passed).not.toBeNull();
    expect(failed).not.toBeNull();
    expect(Number(plan[1])).toBeGreaterThan(0);
    expect(Number(tests[1])).toBe(Number(plan[1]));
    expect(Number(passed[1])).toBe(Number(plan[1]));
    expect(Number(failed[1])).toBe(0);
});
