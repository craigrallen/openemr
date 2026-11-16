const path = require('path');
const { spawnSync } = require('child_process');

const expectedNames = [
  'integer_zero_getter',
  'integer_zero_serialized',
  'string_zero_getter',
  'string_zero_serialized',
  'integer_one_current',
  'string_one_current',
  'missing_activity_current',
  'null_activity_current',
  'positive_two_entered_error',
  'negative_one_entered_error',
  'cross_record_order_fresh_objects',
  'native_source_provenance',
  'nonstatus_serialization_equal',
  'incoming_row_untouched',
  'complete_source_inverse',
].sort();

describe('clinical note FHIR status native PHP fixture', () => {
  test('reports the exact passing case set', () => {
    const fixture = path.resolve(__dirname, '..', 'clinical-ui', 'clinical-note-status.php.fixture');
    const child = spawnSync('php', [fixture], { encoding: 'utf8', timeout: 15000 });

    expect(child.error).toBeUndefined();
    expect(child.signal).toBeNull();
    expect(child.status).toBe(0);
    expect(child.stderr).toBe('');
    expect(child.stdout).toMatch(/^[^\r\n]+\n(?![\s\S])/);

    const report = JSON.parse(child.stdout);
    expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed']);
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.cases.map((entry) => entry.name).sort()).toEqual(expectedNames);
    expect(new Set(report.cases.map((entry) => entry.name)).size).toBe(expectedNames.length);
    for (const entry of report.cases) {
      expect(Object.keys(entry).sort()).toEqual(['error', 'name', 'ok']);
      expect(entry.ok).toBe(true);
      expect(entry.error).toBeNull();
    }
    expect(report.passed).toBe(expectedNames.length);
    expect(report.failed).toBe(0);
  });
});
