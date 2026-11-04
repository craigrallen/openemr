const { spawnSync } = require('node:child_process');
const path = require('node:path');

const fixture = path.resolve(__dirname, '../clinical-ui/facility-narrative-contract.php.fixture');
const expectedNames = [
  'ordinary',
  'ampersand',
  'angle brackets',
  'closing paragraph and injected sibling',
  'both quotes',
  'Swedish Unicode',
  'literal entity-looking text',
  'trimmed narrative',
  'absent name',
  'null name',
  'empty name',
  'whitespace name',
  'string zero name',
  'invalid UTF-8 narrative substitution',
  'strict source preservation',
];

const execution = spawnSync('php', [fixture], {
  cwd: path.resolve(__dirname, '../..'),
  encoding: 'utf8',
  timeout: 30000,
  maxBuffer: 1024 * 1024,
});

const phpMissing = execution.error && execution.error.code === 'ENOENT';
const localPhpMissing = phpMissing && !process.env.CI;

(localPhpMissing ? test.skip : test)('native facility narrative contract', () => {
  if (execution.error) {
    throw execution.error;
  }
  if (execution.signal) {
    throw new Error(`PHP fixture terminated by signal ${execution.signal}: ${execution.stderr || ''}`);
  }
  if (execution.status !== 0) {
    throw new Error(`PHP fixture exited ${execution.status}: ${execution.stdout || ''} ${execution.stderr || ''}`);
  }
  if (execution.stderr) {
    throw new Error(`PHP fixture wrote to stderr: ${execution.stderr}`);
  }
  let report;
  try {
    report = JSON.parse(execution.stdout);
  } catch (error) {
    throw new Error(`PHP fixture did not emit one JSON report: ${error.message}`);
  }
  expect(report).not.toBeNull();
  expect(typeof report).toBe('object');
  expect(Array.isArray(report)).toBe(false);
  expect(Object.keys(report).sort()).toEqual(['cases', 'errors', 'failed', 'source_sha256', 'total']);
  expect(typeof report.source_sha256).toBe('string');
  expect(report.source_sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(report.total).toBe(expectedNames.length);
  expect(report.total).toBeGreaterThan(0);
  expect(report.failed).toBe(0);
  expect(report.errors).toEqual([]);
  expect(Array.isArray(report.cases)).toBe(true);
  expect(report.cases).toHaveLength(expectedNames.length);
  expect(report.cases.map((entry) => entry.name)).toEqual(expectedNames);
  expect(new Set(report.cases.map((entry) => entry.name)).size).toBe(expectedNames.length);
  for (const entry of report.cases) {
    expect(Object.keys(entry).sort()).toEqual(['error', 'name', 'passed']);
    expect(entry.passed).toBe(true);
    expect(entry.error).toBeNull();
  }
});
