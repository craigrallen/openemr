'use strict';
/*
 * OPEMR-70 multi-code selector: Jest adapter for the portable node:test contract.
 *
 * The contract lives in tests/isolated/multi-code-selector-contract.cjs and is
 * dependency-free (Node built-ins only). It runs here in a child Node process via
 * spawnSync so Jest's module registry, transforms and jsdom environment cannot
 * change what the contract sees, and so the contract stays runnable on its own:
 *
 *   node tests/isolated/multi-code-selector-contract.cjs
 *
 * The contract's popup.js checks are SYNTHETIC, NOT NATIVE (node:vm against
 * hand-built windows). Passing here is not a browser, layout, cascade or paint
 * result.
 *
 * Optional history leg: set MULTI_CODE_SELECTOR_HISTORY=1 to also run the contract
 * with --history (needs git and the full base commit; fails rather than skips when
 * either is missing). It is mandatory before merge and is not run by default.
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const CONTRACT = path.join(ROOT, 'tests', 'isolated', 'multi-code-selector-contract.cjs');
const HISTORY = process.env.MULTI_CODE_SELECTOR_HISTORY === '1';

function runContract(extraArgs = []) {
    return spawnSync(process.execPath, ['--test', CONTRACT, ...extraArgs], {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        timeout: 120000,
        // The history flag is chosen explicitly per leg, never inherited.
        env: { ...process.env, MULTI_CODE_SELECTOR_HISTORY: extraArgs.includes('--history') ? '1' : '0' },
    });
}

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

describe('OPEMR-70 multi-code selector contract (portable, via node:test child process)', () => {
    test('the contract file runs and every node:test case passes', () => {
        const result = runContract();
        expect(result.error).toBeUndefined();
        if (result.status !== 0) {
            throw new Error(describeFailure(result));
        }
        expect(result.status).toBe(0);
        // node:test reports "# fail 0" in its summary; guard against a silent empty run.
        expect(result.stdout).toMatch(/^# fail 0$/m);
        expect(result.stdout).not.toMatch(/^# tests 0$/m);
    });
});

(HISTORY ? describe : describe.skip)('OPEMR-70 multi-code selector contract (history leg, mandatory before merge)', () => {
    test('the contract passes with --history against the full base commit', () => {
        const result = runContract(['--history']);
        expect(result.error).toBeUndefined();
        if (result.status !== 0) {
            throw new Error(describeFailure(result));
        }
        expect(result.status).toBe(0);
        expect(result.stdout).toMatch(/^# fail 0$/m);
    });
});
