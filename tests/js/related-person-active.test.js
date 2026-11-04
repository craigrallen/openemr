const { spawnSync } = require('node:child_process');
const path = require('node:path');

const fixture = path.resolve(__dirname, '../clinical-ui/related-person-active-contract.php.fixture');
const expected = [
  'single-expression source boundary',
  'source producer observations',
  'native service and dependency provenance',
  'direct canonical active values',
  'direct legacy false values',
  'full native parse and unchanged fields',
];

test('native RelatedPerson active contract report is complete and passing', () => {
  const run = spawnSync('php', [fixture], { encoding: 'utf8', timeout: 30000 });
  expect(run.error).toBeUndefined();
  expect(run.signal).toBeNull();
  expect(run.stderr).toBe('');
  expect(run.stdout).toBeTruthy();

  let report;
  expect(() => { report = JSON.parse(run.stdout); }).not.toThrow();
  expect(report !== null && typeof report === 'object' && !Array.isArray(report)).toBe(true);
  expect(Object.keys(report).sort()).toEqual(['cases', 'errors', 'failed', 'source_sha256', 'total']);
  expect(Array.isArray(report.cases)).toBe(true);
  expect(Array.isArray(report.errors)).toBe(true);
  expect(report.errors).toEqual([]);
  expect(Number.isInteger(report.total)).toBe(true);
  expect(report.total).toBeGreaterThan(0);
  expect(report.total).toBe(expected.length);
  expect(report.cases).toHaveLength(expected.length);
  expect(report.cases.map((item) => item.name)).toEqual(expected);
  expect(new Set(report.cases.map((item) => item.name)).size).toBe(expected.length);
  for (const item of report.cases) {
    expect(item !== null && typeof item === 'object' && !Array.isArray(item)).toBe(true);
    expect(Object.keys(item).sort()).toEqual(['error', 'name', 'ok']);
    expect(typeof item.name).toBe('string');
    expect(typeof item.ok).toBe('boolean');
    expect(item.error === null || typeof item.error === 'string').toBe(true);
    expect(item.ok).toBe(true);
    expect(item.error).toBeNull();
  }
  expect(Number.isInteger(report.failed)).toBe(true);
  expect(report.failed).toBe(0);
  expect(typeof report.source_sha256).toBe('string');
  expect(report.source_sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(run.status).toBe(0);
});
