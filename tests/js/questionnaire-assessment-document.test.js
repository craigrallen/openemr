/* global __dirname */

// Jest bridge for the dependency-free node:test source contract. It preserves the
// TAP result and exit status, so the absent production presentation stays RED.
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const contract = path.join(__dirname, '../clinical-ui/questionnaire-assessment-document-contract.cjs');

function runContract(extra = []) {
    const result = spawnSync(process.execPath, ['--test-reporter=tap', contract, ...extra], {
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
    expect(tests).toBeGreaterThan(0);
    expect(pass + fail).toBe(tests);
    return { result, output, tests, pass, fail };
}

test('Questionnaire assessment candidate and mutation oracle pass their TAP plan', () => {
    const { result, tests, pass, fail } = runContract(['--candidate']);
    expect(tests).toBeGreaterThanOrEqual(4);
    expect(pass).toBe(tests);
    expect(fail).toBe(0);
    expect(result.status).toBe(0);
});

test('the checked-out production source passes the same contract', () => {
    const { result, tests, pass, fail, output } = runContract();
    expect(tests).toBeGreaterThanOrEqual(5);
    expect(pass).toBe(tests);
    expect(fail).toBe(0);
    expect(result.status).toBe(0);
    expect(output).toContain('current production is RED until the presentation is implemented');
});
