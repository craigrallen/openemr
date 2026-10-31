/** @jest-environment node */

const path = require('path');
const { spawnSync } = require('child_process');

test('native AllergyIntolerance criticality contract', () => {
    const root = path.join(__dirname, '../..');
    const fixture = path.join(root, 'tests/clinical-ui/fhir-allergy-criticality-contract.php.fixture');
    const result = spawnSync('php', [fixture], { cwd: root, encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const report = JSON.parse(result.stdout);
    expect(report).toEqual({ expected: 28, passed: 28, failed: [] });
});
