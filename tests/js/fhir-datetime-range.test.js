'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const fixture = path.resolve(__dirname, '..', 'clinical-ui', 'fhir-datetime-range-contract.php.fixture');
const expectedNames = [
  'source_exact_guard_inverse_sha256',
  'utc_lower_datetime_rejected',
  'utc_lower_date_rejected',
  'utc_lower_object_rejected',
  'utc_upper_datetime_rejected',
  'utc_upper_date_rejected',
  'utc_upper_object_rejected',
  'server_upper_datetime_rejected',
  'server_upper_date_rejected',
  'server_upper_object_rejected',
  'server_lower_datetime_rejected',
  'server_lower_date_rejected',
  'server_lower_object_rejected',
  'utc_lower_datetime_valid',
  'utc_lower_date_valid',
  'utc_lower_object_valid',
  'utc_upper_datetime_valid',
  'utc_upper_date_valid',
  'utc_upper_object_valid',
  'same_offset_lower_valid',
  'same_offset_upper_valid',
  'full_date_lower_valid',
  'full_date_upper_valid',
  'partial_year_allowed',
  'partial_month_allowed',
  'partial_year_forbidden',
  'partial_month_forbidden',
  'null_absent',
  'empty_absent',
  'whitespace_absent',
  'malformed_rejected',
  'invalid_calendar_rejected',
  'nonstring_rejected',
  'input_0999_rejected',
  'dst_winter_conversion',
  'dst_summer_conversion',
  'fraction_dropped_from_db_format',
  'object_server_timezone',
  'overflow_input_precision_unchanged',
  'overflow_input_isvalid_unchanged',
];

describe('FHIR dateTime database year range contract', () => {
  test('native parser fixture reports every fixed case passing', () => {
    const result = spawnSync('php', [fixture], { encoding: 'utf8', timeout: 15000 });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).not.toBeNull();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(typeof result.stdout).toBe('string');
    expect(/^\{[^\r\n]*\}\n(?![\s\S])/.test(result.stdout)).toBe(true);

    const report = JSON.parse(result.stdout);
    expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed']);
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.cases).toHaveLength(expectedNames.length);
    expect(report.cases.length).toBeGreaterThanOrEqual(26);
    expect(new Set(expectedNames).size).toBe(expectedNames.length);
    for (const entry of report.cases) {
      expect(entry !== null && typeof entry === 'object' && !Array.isArray(entry)).toBe(true);
      expect(Object.keys(entry).sort()).toEqual(['name', 'ok']);
      expect(typeof entry.name).toBe('string');
      expect(entry.ok).toBe(true);
    }
    expect(report.cases.map((entry) => entry.name).sort()).toEqual([...expectedNames].sort());
    expect(new Set(report.cases.map((entry) => entry.name)).size).toBe(expectedNames.length);
    expect(report.passed).toBe(expectedNames.length);
    expect(report.failed).toBe(0);
  });
});
