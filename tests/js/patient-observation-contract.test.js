const { spawnSync } = require('node:child_process');
const path = require('node:path');

const expectedNames = [
  'wrong_system_same_code_short_circuit',
  'unknown_system_same_code_short_circuit',
  'system_string_zero_short_circuit',
  'loinc_system_case_sensitive',
  'mixed_wrong_then_loinc',
  'mixed_loinc_then_wrong',
  'mixed_bare_then_wrong',
  'mixed_wrong_then_bare',
  'wrong_supported_then_eligible_unknown_filters_wrong',
  'eligible_unknown_then_wrong_supported_filters_wrong',
  'loinc_composite_path',
  'bare_null_system_composite_path',
  'empty_system_legacy_composite_path',
  'empty_token_legacy_fallback',
  'absent_code_legacy_fallback',
  'unrelated_parameters_forwarded_by_identity',
  'category_invalid_validation_unchanged',
  'code_wrong_type_validation_unchanged',
  'unknown_code_accepted_system_historical_path',
  'source_mapping_and_supports_code',
  'source_aggregator_ignores_system',
  'source_exact_two_insertion_inverse_sha256',
];

describe('OPEMR-263 native patient observation contract', () => {
  test('PHP fixture reports every expected case with the exact CLI protocol', () => {
    const fixture = path.resolve(__dirname, '../clinical-ui/patient-observation-contract.php.fixture');
    const child = spawnSync('php', [fixture], {
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });

    expect(child.error).toBeUndefined();
    expect(child.signal).toBeNull();
    expect(child.status).toBe(0);
    expect(child.stderr).toBe('');
    expect(child.stdout).toMatch(/^\{[^\r\n]*\}\n(?![\s\S])/);

    const report = JSON.parse(child.stdout.slice(0, -1));
    expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed']);
    expect(Number.isInteger(report.passed)).toBe(true);
    expect(Number.isInteger(report.failed)).toBe(true);
    expect(report.passed).toBe(expectedNames.length);
    expect(report.failed).toBe(0);
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.cases).toHaveLength(expectedNames.length);
    expect(new Set(expectedNames).size).toBe(expectedNames.length);
    expect(report.cases.map((item) => item.name).sort()).toEqual([...expectedNames].sort());
    expect(new Set(report.cases.map((item) => item.name)).size).toBe(expectedNames.length);
    for (const item of report.cases) {
      expect(Object.keys(item).sort()).toEqual(['error', 'name', 'ok']);
      expect(typeof item.name).toBe('string');
      expect(item.ok).toBe(true);
      expect(item.error).toBeNull();
    }
  });
});
