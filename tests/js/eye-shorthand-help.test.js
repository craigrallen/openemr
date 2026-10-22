'use strict';
/* Jest adapter for the dependency-free OPEMR-74 contract. Git provenance is
 * separately opt-in: node --test tests/isolated/eye-shorthand-help-contract.cjs --history.
 * The controller runs the genuine RED before any production edit. */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const CONTRACT = path.join(ROOT, 'tests', 'isolated', 'eye-shorthand-help-contract.cjs');

describe('OPEMR-74 eye shorthand help contract (portable)', () => {
    test('node:test completes with no failures', () => {
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
        expect(result.stdout).toMatch(/^# fail 0$/m);
        expect(result.stdout).not.toMatch(/^# tests 0$/m);
        expect(result.stdout).not.toMatch(/mandatory pinned-base Git provenance/);
    });
});
