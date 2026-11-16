const path = require('path');
const { spawnSync } = require('child_process');

const expectedNames = [
  'typed_snomed_getter_and_json',
  'typed_cpt4',
  'multiple_ordered_systems',
  'leading_zero_code',
  'bare_code',
  'typed_zero_suffix',
  'same_suffix_distinct_systems',
  'typed_original_lookup',
  'missing_diagnosis',
  'null_diagnosis',
  'empty_diagnosis',
  'input_unchanged',
  'native_source_provenance',
  'preserves_other_fields',
  'encoded_mode_matches_object',
  'inverse_source_binding',
  'original_source_rejected_by_inverse',
  'native_parser_contract',
];

describe('surgery Procedure coding fixture', () => {
  test('runs the native PHP mapper cases with a strict report', () => {
    const fixture = path.resolve(__dirname, '../clinical-ui/surgery-procedure-coding.php.fixture');
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
    expect(report.passed).toBe(expectedNames.length);
    expect(report.failed).toBe(0);

    const names = report.cases.map((item) => item.name);
    expect(new Set(names).size).toBe(expectedNames.length);
    expect([...names].sort()).toEqual([...expectedNames].sort());
    for (const item of report.cases) {
      expect(Object.keys(item).sort()).toEqual(['error', 'name', 'ok']);
      expect(typeof item.name).toBe('string');
      expect(item.ok).toBe(true);
      expect(item.error).toBe('');
    }
  });
});
