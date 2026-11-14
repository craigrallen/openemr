const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('EHI export start modal name source contract', () => {
  const repo = path.resolve(__dirname, '../..');
  const contract = path.join(repo, 'tests/clinical-ui/ehi-export-start-modal-name-contract.cjs');
  const result = spawnSync(process.execPath, [contract], { cwd: repo, encoding: 'utf8' });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toMatch(/^\{[^\r\n]*\}(?:\r?\n)?(?![\s\S])/);
  const report = JSON.parse(result.stdout);
  expect(Object.keys(report).sort()).toEqual(['tests', 'passed', 'failed', 'failures'].sort());
  expect(report.tests).toBe(18);
  expect(report.passed).toBe(18);
  expect(report.failed).toBe(0);
  expect(report.failures).toEqual([]);
});
