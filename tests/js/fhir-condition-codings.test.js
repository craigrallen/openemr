/** @jest-environment node */

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const fixture = path.join(__dirname, '../clinical-ui/fhir-condition-codings-contract.php.fixture');

test('native FHIR Condition coding contract', () => {
    const run = spawnSync('php', [fixture], { encoding: 'utf8', timeout: 10000 });
    expect(run.error).toBeUndefined();
    expect(run.signal).toBeNull();
    expect(run.stderr).toBe('');
    const lines = run.stdout.trimEnd().split('\n');
    expect(lines).toHaveLength(1);
    const report = JSON.parse(lines[0]);
    expect(report).toEqual({
        expected: 17,
        passed: 17,
        failed: [],
        loader_failed: false,
    });
    expect(run.status).toBe(0);
});
