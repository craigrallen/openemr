const path = require('path');
const { spawnSync } = require('child_process');

const expectedNames = [
  'ascii',
  'empty_string',
  'existing_append_string_zero',
  'existing_preserved_empty',
  'false',
  'integer_42',
  'integer_zero',
  'leading_zero',
  'markdown',
  'missing',
  'native_binding',
  'newline',
  'null',
  'numeric_string_42',
  'source_inverse',
  'string_zero',
  'swedish',
  'whitespace',
];

describe('encounter diagnosis native note contract', () => {
  test('reports every native and source case as passing', () => {
    const root = path.join(__dirname, '..', '..');
    const fixture = path.join(root, 'tests', 'clinical-ui', 'encounter-diagnosis-contract.php.fixture');
    const result = spawnSync('php', [fixture], {
      cwd: root,
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toMatch(/^[^\r\n]+\n(?![\s\S])$/);

    const report = JSON.parse(result.stdout);
    expect(Object.keys(report)).toEqual(['cases', 'failed', 'passed']);
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.cases.map((item) => item.name)).toEqual(expectedNames);
    expect(new Set(report.cases.map((item) => item.name)).size).toBe(expectedNames.length);
    expect(report.passed).toBe(expectedNames.length);
    expect(report.failed).toBe(0);
    for (const item of report.cases) {
      expect(Object.keys(item)).toEqual(['error', 'name', 'ok']);
      expect(item.ok).toBe(true);
      expect(item.error).toBeNull();
    }
  });
});
