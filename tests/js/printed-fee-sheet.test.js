/**
 * @jest-environment node
 *
 * Runs the portable OPEMR-60 printed fee sheet contract suite (node:test) under Jest.
 * History mode needs local Git and is run directly; see docs/clinical-ui/PRINTED-FEE-SHEET.md.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

describe('printed fee sheet popup contract', () => {
    test('portable node:test suite passes', () => {
        const suite = path.join(__dirname, '..', 'printed-fee-sheet.contract.test.cjs');
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
