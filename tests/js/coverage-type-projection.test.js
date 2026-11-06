const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const fixture = path.join(root, 'tests/clinical-ui/coverage-type-projection.php.fixture');
const source = path.join(root, 'src/Services/InsuranceService.php');
const names = [
  'insurer_schema',
  'inner_insurer_projection',
  'outer_coverage_projection',
  'exact_inverse_source_pin',
  'native_service_and_dependencies',
  'public_codes_integer_and_string',
  'private_codes_integer_and_string',
  'missing_null_and_unknown_fallback',
  'non_type_coverage_unchanged',
];

test('native Coverage type projection fixture', () => {
  const result = spawnSync('php', [fixture], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  });

  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.stderr).toBe('');
  expect(typeof result.stdout).toBe('string');
  expect(/^[^\r\n]*\n(?![\s\S])/u.test(result.stdout)).toBe(true);

  const report = JSON.parse(result.stdout);
  expect(Object.keys(report).sort()).toEqual(['cases', 'errors', 'failed', 'source_sha256', 'total']);
  expect(Array.isArray(report.cases)).toBe(true);
  expect(report.cases).toHaveLength(names.length);
  expect(report.cases.map((entry) => entry.name)).toEqual(names);
  for (const entry of report.cases) {
    expect(Object.keys(entry).sort()).toEqual(['error', 'name', 'ok']);
    expect(typeof entry.ok).toBe('boolean');
    if (entry.ok) {
      expect(entry.error).toBeNull();
    } else {
      expect(typeof entry.error).toBe('string');
      expect(entry.error.length).toBeGreaterThan(0);
    }
  }
  expect(report.errors).toEqual([]);
  expect(report.total).toBe(names.length);
  expect(report.failed).toBe(report.cases.filter((entry) => !entry.ok).length);
  expect(report.source_sha256).toMatch(/^[a-f0-9]{64}$/u);
  expect(report.source_sha256).toBe(createHash('sha256').update(readFileSync(source)).digest('hex'));
  expect(result.status).toBe(0);
  expect(report.failed).toBe(0);
});
