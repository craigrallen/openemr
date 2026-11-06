const path = require('path');
const { spawnSync } = require('child_process');

const EXPECTED = 16;

test('Goal description coding identity through native CLI fixture', () => {
  const fixture = path.resolve(__dirname, '../clinical-ui/goal-coding-identity-contract.php.fixture');
  const result = spawnSync('php', [fixture], {
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });

  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.stderr).toBe('');
  expect(result.stdout).toMatch(/^\{[^\r\n]*\}\n$/);

  const report = JSON.parse(result.stdout.trimEnd());
  expect(Object.keys(report).sort()).toEqual(['expected', 'failed', 'passed']);
  expect(report.expected).toBe(EXPECTED);
  expect(report.passed).toBe(EXPECTED);
  expect(report.failed).toEqual([]);
  expect(result.status).toBe(0);
});
