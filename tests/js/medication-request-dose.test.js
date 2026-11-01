/** @jest-environment node */

const path = require('path');
const { spawnSync } = require('child_process');

test('OPEMR-204 native MedicationRequest dosage fixture', () => {
    const fixture = path.join(__dirname, '../clinical-ui/fixtures/medication-request-dose.php.fixture');
    const run = spawnSync('php', [fixture], { encoding: 'utf8' });
    expect(run.error).toBeUndefined();
    expect(run.signal).toBeNull();
    expect(run.stderr).toBe('');
    const report = JSON.parse(run.stdout);
    expect(report.jira).toBe('OPEMR-204');
    expect(report.native_service_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.count).toBe(21);
    expect(report.cases).toHaveLength(report.count);
    expect(report.failed).toBe(0);
    expect(report.passed).toBe(report.count);
    expect(report.cases.every((result) => result.pass === true)).toBe(true);
    expect(report.errors).toEqual([]);
    expect(run.status).toBe(0);
});
