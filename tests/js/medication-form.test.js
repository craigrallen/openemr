const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '../..');
const fixture = path.join(repo, 'tests/clinical-ui/medication-form-contract.php.fixture');
const source = path.join(repo, 'src/Services/FHIR/FhirMedicationService.php');
const mappedNames = Array.from({ length: 12 }, (_, index) => index + 1)
    .flatMap((key) => [`form_${key}_string`, `form_${key}_integer`]);
const expectedNames = [
    'source_exact_single_insertion',
    'native_class_provenance',
    ...mappedNames,
    'omit_unknown',
    'omit_null',
    'omit_empty',
    'omit_zero_string',
    'omit_zero_integer',
    'omit_missing',
    'preserve_projected_fields',
    'inactive_status',
    'independent_resources',
];

test('native Medication form read contract', () => {
    const run = spawnSync('php', [fixture], {
        cwd: repo,
        encoding: 'utf8',
        timeout: 30000,
        maxBuffer: 1024 * 1024,
    });
    expect(run.error).toBeUndefined();
    expect(run.signal).toBeNull();
    expect(run.stderr).toBe('');
    expect([0, 1]).toContain(run.status);

    let report;
    try {
        report = JSON.parse(run.stdout);
    } catch (error) {
        throw new Error(`Fixture did not return strict JSON: ${error.message}`);
    }
    expect(report && typeof report === 'object' && !Array.isArray(report)).toBe(true);
    expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed', 'source_sha256', 'total'].sort());
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.cases).toHaveLength(expectedNames.length);
    expect(report.total).toBe(expectedNames.length);
    expect(Number.isInteger(report.passed)).toBe(true);
    expect(Number.isInteger(report.failed)).toBe(true);
    expect(report.passed).toBeGreaterThanOrEqual(0);
    expect(report.failed).toBeGreaterThanOrEqual(0);
    expect(report.cases.map((entry) => entry.name)).toEqual(expectedNames);
    expect(new Set(report.cases.map((entry) => entry.name)).size).toBe(expectedNames.length);

    for (const entry of report.cases) {
        expect(entry && typeof entry === 'object' && !Array.isArray(entry)).toBe(true);
        expect(Object.keys(entry).sort()).toEqual(['error', 'name', 'ok']);
        expect(typeof entry.name).toBe('string');
        expect(typeof entry.ok).toBe('boolean');
        if (entry.ok) {
            expect(entry.error).toBeNull();
        } else {
            expect(typeof entry.error).toBe('string');
            expect(entry.error.length).toBeGreaterThan(0);
        }
    }

    const passed = report.cases.filter((entry) => entry.ok).length;
    const failed = report.cases.length - passed;
    expect(report.passed).toBe(passed);
    expect(report.failed).toBe(failed);
    expect(report.total).toBe(report.passed + report.failed);
    expect(run.status).toBe(failed === 0 ? 0 : 1);
    const actualSha = createHash('sha256').update(readFileSync(source)).digest('hex');
    expect(report.source_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.source_sha256).toBe(actualSha);

    const failures = report.cases.filter((entry) => !entry.ok)
        .map((entry) => `${entry.name}: ${entry.error}`);
    expect(failures).toEqual([]);
});
