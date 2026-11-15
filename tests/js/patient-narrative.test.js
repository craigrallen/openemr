const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const fixture = path.join(root, 'tests/clinical-ui/patient-narrative.php.fixture');
const expectedCount = 17;

test('native FHIR Patient narrative and name fixture', () => {
  const child = spawnSync('php', [fixture], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });

  expect(child.error).toBeUndefined();
  expect(child.signal).toBeNull();
  expect(child.stderr).toBe('');
  expect(child.stdout).toMatch(/^[\x20-\x7e]*\n(?![\s\S])/);
  const report = JSON.parse(child.stdout.slice(0, -1));
  expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed', 'source_sha256', 'total']);
  expect(report.total).toBe(expectedCount);
  expect(report.cases).toHaveLength(expectedCount);
  expect(report.passed).toBe(expectedCount);
  expect(report.failed).toBe(0);
  expect(report.source_sha256).toMatch(/^[0-9a-f]{64}$/);
  const names = new Set();
  for (const item of report.cases) {
    expect(Object.keys(item).sort()).toEqual(['error', 'name', 'ok']);
    expect(typeof item.name).toBe('string');
    expect(item.name.length).toBeGreaterThan(0);
    expect(names.has(item.name)).toBe(false);
    names.add(item.name);
    expect(typeof item.ok).toBe('boolean');
    expect(item.ok).toBe(true);
    expect(item.error === null || typeof item.error === 'string').toBe(true);
  }
  expect(child.status).toBe(0);
});
