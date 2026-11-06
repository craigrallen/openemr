const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const fixture = path.join(root, 'tests', 'clinical-ui', 'practitioner-role-specialty-contract.php.fixture');
const mapper = path.join(root, 'src', 'Services', 'FHIR', 'FhirPractitionerRoleService.php');
const expectedNames = [
  'source_integrity',
  'native_classes',
  'role_only',
  'specialty_only',
  'both',
  'references_telecom_meta',
  'guard_missing',
  'guard_null',
  'guard_empty',
  'guard_string_zero',
  'guard_integer_zero',
  'nonmutation_independence',
];

const sortedKeys = (value) => Object.keys(value).sort();

describe('PractitionerRole specialty native mapping contract', () => {
  test('PHP fixture passes every native mapping case', () => {
    const result = spawnSync('php', [fixture], {
      cwd: root,
      encoding: 'utf8',
      shell: false,
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
    const report = JSON.parse(result.stdout);
    expect(sortedKeys(report)).toEqual(['cases', 'failed', 'passed', 'source_sha256', 'total']);
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.cases).toHaveLength(expectedNames.length);
    const names = report.cases.map((entry) => {
      expect(sortedKeys(entry)).toEqual(['error', 'name', 'ok']);
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.ok).toBe('boolean');
      expect(entry.ok).toBe(true);
      expect(entry.error).toBeNull();
      return entry.name;
    });
    expect(new Set(names).size).toBe(expectedNames.length);
    expect(names.slice().sort()).toEqual(expectedNames.slice().sort());
    expect(Number.isInteger(report.total)).toBe(true);
    expect(Number.isInteger(report.passed)).toBe(true);
    expect(Number.isInteger(report.failed)).toBe(true);
    expect(report.total).toBe(expectedNames.length);
    expect(report.passed).toBe(expectedNames.length);
    expect(report.failed).toBe(0);
    expect(report.source_sha256).toBe(createHash('sha256').update(readFileSync(mapper)).digest('hex'));
    expect(result.status).toBe(0);
  });
});
