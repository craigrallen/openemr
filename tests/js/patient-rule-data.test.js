'use strict';
/*
 * OPEMR-71 patient rule data screen: Jest adapter for the portable node:test contract.
 *
 * The contract lives in tests/isolated/patient-rule-data-contract.cjs and is
 * dependency-free (Node built-ins only). It runs here in a child Node process so
 * Jest's module registry, transforms and jsdom environment cannot change what the
 * contract sees, and so the contract stays runnable on its own:
 *
 *   node tests/isolated/patient-rule-data-contract.cjs
 *
 * Portable leg only. The --history leg needs git and the full pinned base commit and
 * is run explicitly before merge; it is never run from this hosted wrapper.
 *
 * The contract's popup.js checks are SYNTHETIC, NOT NATIVE (node:vm against
 * hand-built windows). Passing here is not a browser, layout, cascade or paint result.
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const CONTRACT = path.join(ROOT, 'tests', 'isolated', 'patient-rule-data-contract.cjs');

function describeFailure(result) {
    return [
        `exit status: ${result.status}`,
        `signal: ${result.signal}`,
        `spawn error: ${result.error ? result.error.message : 'none'}`,
        '--- stdout ---',
        result.stdout,
        '--- stderr ---',
        result.stderr,
    ].join('\n');
}

describe('OPEMR-71 patient rule data contract (portable, via node:test child process)', () => {
    test('the contract file runs and every node:test case passes', () => {
        const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', CONTRACT], {
            cwd: ROOT,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
            timeout: 120000,
        });
        expect(result.error).toBeUndefined();
        if (result.status !== 0) {
            throw new Error(describeFailure(result));
        }
        expect(result.status).toBe(0);
        // node:test reports "# fail 0" in its summary; guard against a silent empty run.
        expect(result.stdout).toMatch(/^# fail 0$/m);
        expect(result.stdout).not.toMatch(/^# tests 0$/m);
        expect(result.stdout).not.toMatch(/history against the pinned base commit/);
    });
});
