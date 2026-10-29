/* global __dirname, test, expect */

// Hosted Jest bridge for the dependency-free node:test source contract.
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const contract = path.join(__dirname, '../clinical-ui/fee-code-choice-contract.cjs');

function runContract(args, expectedTests) {
    const result = spawnSync(process.execPath, ['--test-reporter=tap', contract, ...args], {
        encoding: 'utf8'
    });
    if (result.error) throw result.error;
    const output = result.stdout + result.stderr;
    const count = (label) => {
        const match = output.match(new RegExp(`^# ${label} (\\d+)$`, 'm'));
        expect(match).not.toBeNull();
        return Number(match[1]);
    };
    const tests = count('tests');
    const pass = count('pass');
    const fail = count('fail');
    expect(tests).toBe(expectedTests);
    expect(pass).toBe(expectedTests);
    expect(fail).toBe(0);
    expect(result.status).toBe(0);
}

test('fee code choice candidate and mutation oracle pass', () => {
    runContract(['--candidate'], 5);
});

test('shipped fee code choice CSS passes the source contract', () => {
    runContract([], 6);
});
