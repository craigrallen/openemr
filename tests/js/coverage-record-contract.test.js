const { spawnSync } = require('node:child_process');
const path = require('node:path');

const fixture = path.resolve(__dirname, '../clinical-ui/coverage-record-contract.php.fixture');
const expectedNames = [
  'empty_policy',
  'false_policy',
  'guard_exact_inverse_sha256',
  'guard_two_occurrences',
  'insurance_search_projection',
  'integer_zero_policy',
  'leading_zeroes',
  'legacy_caller_policy_filter',
  'legacy_writer_bound_policy',
  'missing_policy',
  'native_declarations',
  'null_policy',
  'optional_policy_group_plan',
  'ordinary_policy',
  'padded_policy',
  'single_letter',
  'stored_policy_schema',
  'stored_string_zero',
  'stored_zero_subscriber_independent',
  'unicode_policy',
  'unrelated_resource_fields',
];

describe('OPEMR-261 stored Coverage record contract', () => {
  test('native PHP fixture reports the complete contract', () => {
    const result = spawnSync('php', [fixture], {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toMatch(/^\{[^\r\n]*\}\n(?![\s\S])/);

    const report = JSON.parse(result.stdout.slice(0, -1));
    expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed']);
    expect(Number.isInteger(report.passed)).toBe(true);
    expect(Number.isInteger(report.failed)).toBe(true);
    expect(Array.isArray(report.cases)).toBe(true);
    const names = report.cases.map((entry) => entry.name);
    expect(names.slice().sort()).toEqual(expectedNames);
    expect(new Set(names).size).toBe(expectedNames.length);
    for (const entry of report.cases) {
      expect(Object.keys(entry).sort()).toEqual(['error', 'name', 'ok']);
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.ok).toBe('boolean');
      expect(entry.error === null || typeof entry.error === 'string').toBe(true);
      expect(entry.ok).toBe(true);
      expect(entry.error).toBeNull();
    }
    expect(report.passed).toBe(expectedNames.length);
    expect(report.failed).toBe(0);
    expect(report.passed + report.failed).toBe(report.cases.length);
  });
});
