const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '../..');
const fixture = path.join(repo, 'tests/clinical-ui/diagnostic-code-search.php.fixture');

test('native DiagnosticReport code search contract', () => {
  const run = spawnSync('php', [fixture], {
    cwd: repo,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });

  expect(run.error).toBeUndefined();
  expect(run.status).toBe(0);
  expect(run.signal).toBeNull();
  expect(run.stderr).toBe('');
  expect(run.stdout).toMatch(/^\{[^\r\n]*\}\n(?![\s\S])/);

  const report = JSON.parse(run.stdout.slice(0, -1));
  expect(Object.keys(report).sort()).toEqual(['expected', 'failed', 'passed'].sort());
  expect(report.expected).toBe(17);
  expect(report.passed).toBe(17);
  expect(report.failed).toEqual([]);
});
