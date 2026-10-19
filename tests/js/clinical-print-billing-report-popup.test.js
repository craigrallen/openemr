/**
 * Runs the portable node:test contract for the print-billing-report popup (OPEMR-55) under
 * Jest, so `npm run test:js` covers it without changing the Jest configuration. The wrapper
 * itself never calls Git; a hosted shallow checkout runs the portable suite. The target root
 * (PRINT_BILLING_REPORT_TARGET_ROOT, default this checkout) and REQUIRE_GIT_BASELINE are
 * inherited by the child run, so mandatory baseline authentication stays opt-in.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const CONTRACT = path.resolve(__dirname, '../clinical/print-billing-report-popup.test.cjs');
const ROOT = process.env.PRINT_BILLING_REPORT_TARGET_ROOT
    ? path.resolve(process.env.PRINT_BILLING_REPORT_TARGET_ROOT)
    : path.resolve(__dirname, '../..');

test('print-billing-report popup node:test contract passes', () => {
    let output;
    try {
        output = execFileSync(process.execPath, ['--test', CONTRACT], {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, PRINT_BILLING_REPORT_TARGET_ROOT: ROOT },
        });
    } catch (error) {
        throw new Error(`contract exited with ${error.status}\n${error.stdout ?? ''}\n${error.stderr ?? ''}`);
    }
    // Exit status 0 already means no failure; also require the reporter's zero-fail summary
    // (TAP "# fail 0" or spec "ℹ fail 0", depending on the Node version's default reporter).
    expect(output).toMatch(/^(?:#|ℹ) fail 0$/m);
}, 60000);
