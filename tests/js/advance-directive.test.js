const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const fixture = path.join(root, 'tests/clinical-ui/advance-directive-contract.php.fixture');
const ids = [
  'unknown_single', 'unknown_multiple', 'unknown_system',
  'supported_single', 'supported_mixed', 'omitted_code',
  'explicit_empty', 'wrong_code_type', 'bad_category',
];

const expected = {
  unknown_single: [0, [], []],
  unknown_multiple: [0, [], []],
  unknown_system: [0, [], []],
  supported_single: [1, ['Error retrieving advance directive observations'], []],
  supported_mixed: [1, ['Error retrieving advance directive observations'], []],
  omitted_code: [1, ['Error retrieving advance directive observations'], []],
  explicit_empty: [1, ['Error retrieving advance directive observations'], []],
  wrong_code_type: [0, [], { code: 'Invalid code' }],
  bad_category: [0, [], { category: "invalid value - only 'assessment' category is supported" }],
};

test('advance directive native search contract', () => {
  const run = spawnSync('php', [fixture], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });

  expect(run.error).toBeUndefined();
  expect(run.signal).toBeNull();
  expect(run.stderr).toBe('');
  expect(run.stdout).toMatch(/^\{[^\r\n]*\}\n(?![\s\S])/);
  const report = JSON.parse(run.stdout);
  expect(Object.keys(report)).toEqual(['source_gate', 'counts', 'cases', 'failure']);
  expect(['original', 'allowed_insertion']).toContain(report.source_gate);
  expect(report.failure).toBeNull();
  expect(report.cases.map((entry) => entry.id)).toEqual(ids);
  expect(report.counts).toEqual({ total: 9, passed: 9, failed: 0, sql_calls: 4 });
  for (const entry of report.cases) {
    expect(Object.keys(entry)).toEqual(['id', 'passed', 'sql_calls', 'internal_errors', 'validation_messages', 'data_count']);
    expect(entry.passed).toBe(true);
    expect([entry.sql_calls, entry.internal_errors, entry.validation_messages]).toEqual(expected[entry.id]);
    expect(entry.data_count).toBe(0);
  }
  expect(run.status).toBe(0);
});
