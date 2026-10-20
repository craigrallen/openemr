'use strict';
/* OPEMR-77 Jest adapter for the portable, source-only contract. */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const CONTRACT = path.join(ROOT, 'tests', 'isolated', 'dorn-compendium-contract.cjs');

describe('OPEMR-77 DORN compendium source contract', () => {
    test('portable node:test TAP executed real cases without failures', () => {
        const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', CONTRACT], {
            cwd: ROOT,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
            timeout: 120000,
        });
        expect(result.error).toBeUndefined();
        if (result.status !== 0) {
            throw new Error([
                `exit status: ${result.status}`,
                `signal: ${result.signal}`,
                '--- stdout ---', result.stdout,
                '--- stderr ---', result.stderr,
            ].join('\n'));
        }
        expect(result.stdout).toMatch(/^TAP version 13$/m);
        const total = result.stdout.match(/^# tests (\d+)$/m);
        const passed = result.stdout.match(/^# pass (\d+)$/m);
        const failed = result.stdout.match(/^# fail (\d+)$/m);
        expect(total).not.toBeNull();
        expect(passed).not.toBeNull();
        expect(failed).not.toBeNull();
        expect(Number(total[1])).toBeGreaterThan(0);
        expect(Number(passed[1])).toBe(Number(total[1]));
        expect(Number(failed[1])).toBe(0);
        expect(result.stdout).not.toMatch(/pinned Git provenance \(--history only\)/);
    });
});
