const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const fixture = path.join(root, 'tests/clinical-ui/appointment-patient-scope.php.fixture');
const expectedNames = [
  'mismatched_patient',
  'matching_integer_pid',
  'matching_string_pid',
  'leading_zero_pid',
  'very_large_pid',
  'zero_pid',
  'negative_requested_pid',
  'signed_requested_pid',
  'whitespace_requested_pid',
  'newline_requested_pid',
  'stored_float_pid',
  'stored_exponent_pid',
  'stored_negative_pid',
  'stored_signed_pid',
  'stored_whitespace_pid',
  'stored_newline_pid',
  'missing_pc_pid',
  'missing_record',
  'non_array_first_row',
  'joined_pid_distractor',
  'global_route_unscoped',
  'global_empty_result',
  'source_inverse',
];

test('native appointment patient detail route preserves patient scope', () => {
  const child = spawnSync('php', [fixture], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 1024 * 1024,
  });
  if (child.error) throw child.error;
  expect(child.signal).toBeNull();
  expect(child.stderr).toBe('');
  expect(child.stdout.endsWith('\n')).toBe(true);
  expect(child.stdout.indexOf('\n')).toBe(child.stdout.length - 1);
  expect(child.stdout.includes('\r')).toBe(false);

  const report = JSON.parse(child.stdout.slice(0, -1));
  expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed', 'tests']);
  expect(Number.isInteger(report.tests)).toBe(true);
  expect(Number.isInteger(report.passed)).toBe(true);
  expect(Number.isInteger(report.failed)).toBe(true);
  expect(Array.isArray(report.cases)).toBe(true);
  expect(report.tests).toBe(expectedNames.length);
  expect(report.cases).toHaveLength(expectedNames.length);
  expect(report.cases.map((item) => item.name)).toEqual(expectedNames);
  for (const item of report.cases) {
    expect(typeof item.name).toBe('string');
    expect(typeof item.ok).toBe('boolean');
    expect(Object.keys(item).sort()).toEqual(item.ok ? ['name', 'ok'] : ['error', 'name', 'ok']);
    if (!item.ok) expect(typeof item.error).toBe('string');
  }
  expect(report.passed).toBe(report.cases.filter((item) => item.ok).length);
  expect(report.failed).toBe(report.cases.filter((item) => !item.ok).length);
  if (child.status !== 0 || report.failed !== 0) {
    throw new Error(`PHP fixture failed (exit ${child.status}): ${JSON.stringify(report.cases.filter((item) => !item.ok))}`);
  }
});
