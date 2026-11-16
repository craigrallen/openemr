const path = require('path');
const { spawnSync } = require('child_process');

const expectedNames = [
  'source_inverse',
  'native_pipe_and_builder_boundary',
  'unknown_only',
  'zero_system',
  'repeated_unknown_cached_once',
  'loinc_pair',
  'snomed_three_aliases',
  'cpt_pair',
  'rxnorm_rxcui_pair',
  'unknown_then_known',
  'known_then_unknown',
  'bare_then_unknown',
  'unknown_then_bare',
  'same_code_different_systems',
  'leading_zero_code',
  'literal_zero_code',
  'no_code_forwarding',
  'backend_error_identity',
  'backend_pagination_identity',
  'missing_system_bare',
  'null_system_bare',
  'empty_system_bare',
  'empty_token_values_forwarded',
  'caller_input_and_reference_unchanged',
];

describe('Observation form code search native PHP fixture', () => {
  test('reports the complete unique case set with no failures', () => {
    const fixture = path.resolve(__dirname, '..', 'clinical-ui', 'observation-form-code-search.php.fixture');
    const child = spawnSync('php', [fixture], {
      cwd: path.resolve(__dirname, '..', '..'),
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });

    expect(child.error).toBeUndefined();
    expect(child.signal).toBeNull();
    expect(child.status).toBe(0);
    expect(child.stderr).toBe('');
    expect(child.stdout).toMatch(/^[^\r\n]+\n(?![\s\S])/);

    const report = JSON.parse(child.stdout);
    expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed']);
    expect(Number.isInteger(report.passed)).toBe(true);
    expect(Number.isInteger(report.failed)).toBe(true);
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.cases).toHaveLength(expectedNames.length);
    expect(report.cases.map((entry) => entry.name).sort()).toEqual([...expectedNames].sort());
    expect(new Set(report.cases.map((entry) => entry.name)).size).toBe(expectedNames.length);

    for (const entry of report.cases) {
      expect(Object.keys(entry).sort()).toEqual(['error', 'name', 'ok']);
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.ok).toBe('boolean');
      expect(entry.error === null || typeof entry.error === 'string').toBe(true);
      expect(entry.ok ? entry.error : typeof entry.error === 'string').toBe(entry.ok ? null : true);
    }
    expect(report.passed).toBe(report.cases.filter((entry) => entry.ok).length);
    expect(report.failed).toBe(report.cases.filter((entry) => !entry.ok).length);
    expect(report.passed).toBe(expectedNames.length);
    expect(report.failed).toBe(0);
  });
});
