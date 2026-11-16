const { spawnSync } = require('node:child_process');
const path = require('node:path');

const expectedNames = [
  'native view path',
  'native new path',
  'native report path',
  'LBF native root and flag',
  'LBT native root and flag',
  'dispatch name payload and ordinary flag',
  'approved override returned',
  'approved override cached',
  'rejected override falls back',
  'rejected fallback cached',
  'rejected path never probed',
  'rejection log exact path and form',
  'missing fallback logs native path',
  'missing unchanged native logs',
  'cache separates forms',
  'cache separates pages',
  'cache separates files',
  'single fragment and original source SHA256',
].sort();

describe('FormLocator rejected override fixture', () => {
  test('runs every native public-path case and preserves the source boundary', () => {
    const fixture = path.resolve(__dirname, '../clinical-ui/form-locator-rejected-override.php.fixture');
    const result = spawnSync('php', [fixture], { encoding: 'utf8', timeout: 15000 });

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toMatch(/^[^\r\n]+\n(?![\s\S])/);

    const report = JSON.parse(result.stdout.slice(0, -1));
    expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed']);
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.cases).toHaveLength(expectedNames.length);
    for (const item of report.cases) {
      expect(Object.keys(item).sort()).toEqual(['name', 'ok']);
      expect(typeof item.name).toBe('string');
      expect(typeof item.ok).toBe('boolean');
      expect(item.ok).toBe(true);
    }
    const actualNames = report.cases.map((item) => item.name);
    expect(new Set(actualNames).size).toBe(expectedNames.length);
    expect(actualNames.sort()).toEqual(expectedNames);
    expect(report.passed).toBe(expectedNames.length);
    expect(report.failed).toBe(0);
  });
});
