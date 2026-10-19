/**
 * Runs the portable node:test contract for the ICD9 how-to popup (OPEMR-53) under Jest,
 * so `npm run test:js` covers it without changing the Jest configuration.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const CONTRACT = path.resolve(__dirname, '../fixtures/clinical-workspace/icd9-howto-popup.contract.cjs');

test('ICD9 how-to popup node:test contract passes', () => {
    const result = spawnSync(process.execPath, ['--test', CONTRACT], {
        cwd: path.resolve(__dirname, '../..'),
        encoding: 'utf8',
        env: process.env,
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`contract exited with ${result.status}\n${result.stdout}\n${result.stderr}`);
    }
    expect(result.status).toBe(0);
}, 60000);
