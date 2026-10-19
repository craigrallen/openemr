/**
 * Runs the portable node:test contract for the print-amendments popup (OPEMR-54) under Jest,
 * so `npm run test:js` covers it without changing the Jest configuration. The target root
 * (PRINT_AMENDMENTS_TARGET_ROOT, default this checkout) and REQUIRE_GIT_BASELINE are
 * inherited by the child run.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const CONTRACT = path.resolve(__dirname, '../clinical/print-amendments-popup.test.cjs');
const ROOT = process.env.PRINT_AMENDMENTS_TARGET_ROOT
    ? path.resolve(process.env.PRINT_AMENDMENTS_TARGET_ROOT)
    : path.resolve(__dirname, '../..');

test('print-amendments popup node:test contract passes', () => {
    const result = spawnSync(process.execPath, ['--test', CONTRACT], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, PRINT_AMENDMENTS_TARGET_ROOT: ROOT },
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`contract exited with ${result.status}\n${result.stdout}\n${result.stderr}`);
    }
    expect(result.status).toBe(0);
}, 60000);
