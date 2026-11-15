const { spawnSync } = require('node:child_process');
const path = require('node:path');

const expectedNames = [
  'source_integrity',
  'native_classes',
  'nucc_typed_object_json',
  'hl7_rolecode_typed',
  'typed_no_title_lookup',
  'bare_stripped_snomed',
  'snomed_ct_alias',
  'snomed_alias_lookup',
  'unknown_prefix_fallback',
  'missing_codes_role_fallback',
  'null_codes_role_fallback',
  'empty_codes_role_fallback',
  'zero_codes_role_fallback',
  'unknown_role_default',
  'title_priority_physician',
  'title_priority_role',
  'provider_period_member_onbehalfof_order',
  'no_providers',
].sort();

function sortedKeys(value) {
  return Object.keys(value).sort();
}

function readFixture() {
  const fixture = path.resolve(__dirname, '../clinical-ui/care-team-contract.php.fixture');
  const result = spawnSync('php', [fixture], {
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 1024 * 1024,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.stderr).toBe('');
  expect(result.stdout).toMatch(/^[^\r\n]+\n(?![\s\S])/);
  const report = JSON.parse(result.stdout.slice(0, -1));
  expect(sortedKeys(report)).toEqual(['cases', 'failed', 'passed', 'total']);
  expect(Number.isInteger(report.total)).toBe(true);
  expect(Number.isInteger(report.passed)).toBe(true);
  expect(Number.isInteger(report.failed)).toBe(true);
  expect(Array.isArray(report.cases)).toBe(true);
  expect(report.total).toBe(expectedNames.length);
  expect(report.cases).toHaveLength(expectedNames.length);
  expect(report.passed + report.failed).toBe(report.total);
  for (const entry of report.cases) {
    expect(sortedKeys(entry)).toEqual(['message', 'name', 'passed']);
    expect(typeof entry.name).toBe('string');
    expect(typeof entry.passed).toBe('boolean');
    expect(typeof entry.message).toBe('string');
  }
  const names = report.cases.map((entry) => entry.name);
  expect(new Set(names).size).toBe(expectedNames.length);
  expect(names.sort()).toEqual(expectedNames);
  expect(report.passed).toBe(report.cases.filter((entry) => entry.passed).length);
  expect(report.failed).toBe(report.cases.filter((entry) => !entry.passed).length);
  expect(result.status).toBe(report.failed === 0 ? 0 : 1);
  return report;
}

describe('CareTeam native provider role contract', () => {
  test('all named cases pass', () => {
    const report = readFixture();
    expect(report.cases.filter((entry) => !entry.passed)).toEqual([]);
    expect(report.failed).toBe(0);
  });
});
