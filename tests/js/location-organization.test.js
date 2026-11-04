const { spawnSync } = require('node:child_process');
const path = require('node:path');

const fixture = path.resolve(__dirname, '../clinical-ui/location-organization-contract.php.fixture');
const expected = [
  'source binding',
  'native service and model',
  'setter and repeated getter identity',
  'replacement before getter',
  'replacement after getter',
  'replacement after lazy default',
  'distinct location instances',
  'lazy getter constructs once',
  'parsed managing organization and encoded JSON',
  'null organization reference omitted',
  'switching dependency changes parsed reference',
  'native location fields and unchanged input',
];

test('native Location organization contract report is complete and passing', () => {
  const run = spawnSync('php', [fixture], { encoding: 'utf8', timeout: 30000 });
  expect(run.error).toBeUndefined();
  expect(run.signal).toBeNull();
  expect(run.stderr).toBe('');
  expect(run.stdout).toBeTruthy();
  let report;
  expect(() => { report = JSON.parse(run.stdout); }).not.toThrow();
  expect(Object.keys(report).sort()).toEqual(['cases', 'errors', 'failed', 'source_sha256', 'total']);
  expect(Array.isArray(report.cases)).toBe(true);
  expect(Array.isArray(report.errors)).toBe(true);
  expect(report.errors).toEqual([]);
  expect(report.total).toBe(expected.length);
  expect(report.cases).toHaveLength(expected.length);
  expect(report.cases.map((item) => item.name)).toEqual(expected);
  expect(new Set(report.cases.map((item) => item.name)).size).toBe(expected.length);
  for (const item of report.cases) {
    expect(Object.keys(item).sort()).toEqual(['error', 'name', 'ok']);
    expect(typeof item.ok).toBe('boolean');
    expect(item.error === null || typeof item.error === 'string').toBe(true);
  }
  expect(report.failed).toBe(0);
  expect(report.cases.every((item) => item.ok === true && item.error === null)).toBe(true);
  expect(report.source_sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(run.status).toBe(0);
});
