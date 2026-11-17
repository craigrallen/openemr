const path = require('path');
const { spawnSync } = require('child_process');

const expectedNames = [
  'option7_empty',
  'option7_stringzero',
  'option7_zero_int',
  'option7_null',
  'option7_digitless',
  'option7_swedish_digitless',
  'option7_pobox',
  'option7_leadingzeros',
  'option7_negative',
  'option7_firsttoken',
  'option7_unicode_non_ascii_digits',
  'mode0',
  'mode1',
  'mode2',
  'mode3',
  'mode4',
  'mode5',
  'mode6',
  'unknown_default',
  'immutability',
  'strictinverse',
].sort();

describe('native insurance display number', () => {
  test('reports every exact case as passed', () => {
    const fixture = path.resolve(__dirname, '..', 'clinical-ui', 'insurance-display-number.php.fixture');
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
    expect(result.stdout).toMatch(/^\{[^\r\n]*\}\n(?![\s\S])/);
    expect(result.stdout.indexOf('\n')).toBe(result.stdout.length - 1);
    expect(result.stdout).not.toContain('\r');

    const report = JSON.parse(result.stdout.slice(0, -1));
    expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed']);
    expect(Number.isInteger(report.passed)).toBe(true);
    expect(Number.isInteger(report.failed)).toBe(true);
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.cases.map(({ name }) => name).sort()).toEqual(expectedNames);
    expect(new Set(report.cases.map(({ name }) => name)).size).toBe(expectedNames.length);
    for (const entry of report.cases) {
      expect(Object.keys(entry).sort()).toEqual(['error', 'name', 'ok']);
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.ok).toBe('boolean');
      expect(entry.error === null || typeof entry.error === 'string').toBe(true);
    }
    expect(report.passed + report.failed).toBe(expectedNames.length);
    expect(report.passed).toBe(expectedNames.length);
    expect(report.failed).toBe(0);
    expect(report.cases.every(({ ok, error }) => ok === true && error === null)).toBe(true);
  });
});
