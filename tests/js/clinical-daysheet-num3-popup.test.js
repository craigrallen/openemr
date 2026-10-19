/**
 * Runs the portable node:test contract for the day sheet num3 popup (OPEMR-58) under Jest, so
 * `npm run test:js` covers it without changing the Jest configuration. The wrapper runs the
 * portable mode only: it removes REQUIRE_GIT_BASELINE from the child environment, so a hosted
 * shallow checkout never needs the base commit. Mandatory Git-base authentication is a separate,
 * explicit run of the contract itself. The target root (DAYSHEET_NUM3_TARGET_ROOT, default this
 * checkout) is inherited.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const CONTRACT = path.resolve(__dirname, '../clinical/daysheet-num3-popup.test.cjs');
const ROOT = process.env.DAYSHEET_NUM3_TARGET_ROOT
    ? path.resolve(process.env.DAYSHEET_NUM3_TARGET_ROOT)
    : path.resolve(__dirname, '../..');

test('day sheet num3 popup node:test contract passes (portable mode)', () => {
    const env = { ...process.env, DAYSHEET_NUM3_TARGET_ROOT: ROOT };
    delete env.REQUIRE_GIT_BASELINE;
    let output;
    try {
        output = execFileSync(process.execPath, ['--test', CONTRACT], {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            env,
        });
    } catch (error) {
        throw new Error(`contract exited with ${error.status}\n${error.stdout ?? ''}\n${error.stderr ?? ''}`);
    }
    // Exit status 0 already means no failure; also require the reporter's zero-fail summary
    // (TAP "# fail 0" or spec "ℹ fail 0", depending on the Node version's default reporter).
    expect(output).toMatch(/^(?:#|ℹ) fail 0$/m);
}, 60000);
