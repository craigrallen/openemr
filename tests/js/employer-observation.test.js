const path = require('path');
const { spawnSync } = require('child_process');

const expectedNames = [
  'source-preservation',
  'internal-error-identity',
  'validation-error-identity',
  'combined-error-no-data-read',
  'invalid-category-before-backend',
  'invalid-code-before-backend',
  'success-empty-fresh-result',
  'success-native-occupation-observation',
  'unsupported-code-row-skip',
  'forwarded-fields-and-native-filter',
];

test('native employer observation ProcessingResult contract', () => {
  const root = path.resolve(__dirname, '../..');
  const fixture = path.join(root, 'tests/clinical-ui/employer-observation-contract.php.fixture');
  const child = spawnSync('php', [fixture], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });

  expect(child.error).toBeUndefined();
  expect(child.signal).toBeNull();
  expect(child.stderr).toBe('');
  expect(child.stdout).toMatch(/^[^\r\n]+\n(?![\s\S])/);

  const report = JSON.parse(child.stdout.slice(0, -1));
  expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed', 'total'].sort());
  expect(report.total).toBe(expectedNames.length);
  expect(report.passed).toBe(expectedNames.length);
  expect(report.failed).toBe(0);
  expect(Array.isArray(report.cases)).toBe(true);
  expect(report.cases).toHaveLength(expectedNames.length);
  expect(report.cases.map(({ name }) => name).sort()).toEqual([...expectedNames].sort());
  expect(new Set(report.cases.map(({ name }) => name)).size).toBe(expectedNames.length);
  for (const entry of report.cases) {
    expect(Object.keys(entry).sort()).toEqual(['message', 'name', 'passed'].sort());
    expect(entry.passed).toBe(true);
    expect(entry.message).toBe('');
  }
  expect(child.status).toBe(0);
});
