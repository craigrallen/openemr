'use strict';
/* Jest adapter for the dependency-free portable node:test contract. History is
 * an explicit separate invocation: node tests/isolated/address-book-list-contract.cjs --history.
 * RED is expected until the production route receives the approved presentation. */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const CONTRACT = path.join(ROOT, 'tests', 'isolated', 'address-book-list-contract.cjs');

describe('OPEMR-73 address book list contract (portable)', () => {
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
        expect(result.stdout).not.toMatch(/mandatory pinned-base history/);
    });
});
