const { spawnSync } = require('node:child_process');
const path = require('node:path');

const expectedNames = [
  'ordinary',
  'ampersand',
  'brackets',
  'closingparagraph/script',
  'quotes',
  'SwedishUnicode',
  'entitylookingtext',
  'paddedname',
  'absent',
  'null',
  'empty',
  'whitespace',
  'stringzero',
  'inactive',
  'npiomitted',
  'nonnamefields/provenance',
  'invalidUTF8',
  'strictinverse',
];

describe('procedure provider native narrative fixture', () => {
  test('reports every exact native case as passing', () => {
    const fixture = path.resolve(__dirname, '../clinical-ui/procedure-provider-narrative.php.fixture');
    const result = spawnSync('php', [fixture], {
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(typeof result.stdout).toBe('string');
    expect(result.stdout).toMatch(/^[^\r\n]*\n(?![\s\S])/);

    const report = JSON.parse(result.stdout.slice(0, -1));
    expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed']);
    expect(Number.isInteger(report.passed)).toBe(true);
    expect(Number.isInteger(report.failed)).toBe(true);
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.cases).toHaveLength(expectedNames.length);
    expect(report.cases.map((entry) => entry.name)).toEqual(expectedNames);
    expect(new Set(report.cases.map((entry) => entry.name)).size).toBe(expectedNames.length);
    for (const entry of report.cases) {
      expect(Object.keys(entry).sort()).toEqual(['error', 'name', 'ok']);
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.ok).toBe('boolean');
      expect(entry.error === null || typeof entry.error === 'string').toBe(true);
      expect(entry).toEqual({ name: entry.name, ok: true, error: null });
    }
    expect(report.passed).toBe(expectedNames.length);
    expect(report.failed).toBe(0);
  });
});
