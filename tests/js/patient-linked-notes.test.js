/**
 * @jest-environment node
 *
 * Jest invokes the portable OPEMR-62 source contract only. The controller runs
 * --history separately for local Git provenance.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

describe('patient-linked notes popup contract', () => {
    test('portable node:test suite passes', () => {
        const suite = path.join(__dirname, '..', 'patient-linked-notes.contract.test.cjs');
        const env = { ...process.env };
        delete env.NODE_TEST_CONTEXT;
        const result = spawnSync(process.execPath, ['--test', suite], {
            cwd: path.join(__dirname, '..', '..'),
            encoding: 'utf8',
            env,
            timeout: 120000
        });
        if (result.status !== 0) {
            throw new Error(`node --test exited ${result.status}\n${result.stdout}\n${result.stderr}`);
        }
        expect(result.status).toBe(0);
    });
});
