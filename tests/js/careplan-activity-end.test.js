/** @jest-environment node */

const path = require('path');
const { spawnSync } = require('child_process');

test('native CarePlan activity end dates reach each FHIR activity and the plan period', () => {
    const root = path.join(__dirname, '../..');
    const fixture = path.join(root, 'tests/clinical-ui/fixtures/careplan-activity-end.php.fixture');
    const result = spawnSync('php', [fixture], { cwd: root, encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    let report;
    expect(() => {
        report = JSON.parse(result.stdout);
    }).not.toThrow();
    expect(report).toEqual({ expected: 20, passed: 20, failed: [] });
});
