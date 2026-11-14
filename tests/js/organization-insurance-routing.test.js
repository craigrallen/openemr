const path = require('path');
const { spawnSync } = require('child_process');

test('Organization insurance routing fixture', () => {
  const repo = path.resolve(__dirname, '../..');
  const fixture = path.resolve(__dirname, '../clinical-ui/organization-insurance-routing.php.fixture');
  const run = spawnSync('php', [fixture], { cwd: repo, encoding: 'utf8' });

  expect(run.error).toBeUndefined();
  expect(run.status).toBe(0);
  expect(run.stderr).toBe('');
  expect(run.stdout).toMatch(/^\{[^\r\n]*\}(?:\r?\n)?(?![\s\S])/);

  const report = JSON.parse(run.stdout);
  expect(Object.keys(report).sort()).toEqual(['failed', 'failures', 'passed', 'tests'].sort());
  expect(report.tests).toBe(21);
  expect(report.passed).toBe(report.tests);
  expect(report.failed).toBe(0);
  expect(report.failures).toEqual([]);
});
