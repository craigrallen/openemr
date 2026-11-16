const path = require('path');
const { spawnSync } = require('child_process');

const fixture = path.resolve(__dirname, '../clinical-ui/soap-text-retention.php.fixture');
const fields = ['subjective', 'objective', 'assessment', 'plan'];
const fieldCases = fields.flatMap((field) => [
  `empty-${field}`,
  `zero-${field}`,
  `normal-${field}`,
  `unicode-${field}`,
  `newline-${field}`,
  `whitespace-${field}`,
  `overwrite-${field}`,
]);
const expectedNames = [
  ...fieldCases,
  'ignored-null',
  'ignored-false',
  'ignored-integer-zero',
  'ignored-float-zero',
  'ignored-empty-array',
  'assigned-truthy-number',
  'assigned-truthy-bool',
  'assigned-truthy-array',
  'assigned-truthy-object',
  'exact-source-inverse',
];

describe('native SOAP text retention', () => {
  test('reports every setter and source-inverse case as passing', () => {
    const result = spawnSync('php', [fixture], {
      encoding: 'utf8',
      timeout: 15000,
    });

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).not.toBeNull();
    expect(result.stderr).toBe('');
    expect(typeof result.stdout).toBe('string');
    const framed = /^([^\r\n]+)\n(?![\s\S])/.exec(result.stdout);
    expect(framed).not.toBeNull();
    const report = JSON.parse(framed[1]);
    expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed'].sort());
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.cases).toHaveLength(expectedNames.length);
    for (const item of report.cases) {
      expect(Object.keys(item).sort()).toEqual(['name', 'ok'].sort());
      expect(typeof item.name).toBe('string');
      expect(typeof item.ok).toBe('boolean');
      expect(item.ok).toBe(true);
    }
    const actualNames = report.cases.map((item) => item.name);
    expect(new Set(actualNames).size).toBe(actualNames.length);
    expect(actualNames.sort()).toEqual(expectedNames.slice().sort());
    expect(report.passed).toBe(expectedNames.length);
    expect(report.failed).toBe(0);
    expect(result.status).toBe(0);
  });
});
