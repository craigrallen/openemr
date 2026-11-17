const path = require('node:path');
const { spawnSync } = require('node:child_process');

const expectedCaseNames = [
    'native_service_provenance',
    'approved_single_line_inverse',
    'legacy_condition_date_alias',
    'date_alias_exactly_once',
    'date_alias_immediately_after_legacy',
    'projected_creation_is_recorded_date',
    'projected_creation_is_asserted_date',
    'projected_onset_stays_distinct',
    'projected_json_matches_object',
    'explicit_creation_recorded_date',
    'explicit_creation_asserted_extension',
    'missing_date_uses_onset',
    'null_date_uses_onset',
    'empty_date_omits_recorded_and_asserted',
    'no_creation_no_onset_omits_dates',
    'input_row_is_not_mutated',
    'abatement_remains_independent',
];

describe('OPEMR-264 health concern date mapping', () => {
    test('native CLI fixture reports the complete regression matrix', () => {
        const fixture = path.resolve(__dirname, '../clinical-ui/health-concern-dates.php.fixture');
        const result = spawnSync('php', [fixture], {
            cwd: path.resolve(__dirname, '../..'),
            encoding: 'utf8',
            timeout: 15000,
        });

        expect(result.error).toBeUndefined();
        expect(result.signal).toBeNull();
        expect(result.stderr).toBe('');
        expect(result.stdout).toMatch(/^[^\r\n]+\n(?![\s\S])/);

        const report = JSON.parse(result.stdout);
        expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed']);
        expect(Number.isInteger(report.passed)).toBe(true);
        expect(Number.isInteger(report.failed)).toBe(true);
        expect(Array.isArray(report.cases)).toBe(true);
        expect(report.cases).toHaveLength(expectedCaseNames.length);
        expect(report.cases.map((item) => item.name)).toEqual(expectedCaseNames);
        expect(new Set(report.cases.map((item) => item.name)).size).toBe(expectedCaseNames.length);
        for (const item of report.cases) {
            expect(Object.keys(item).sort()).toEqual(['error', 'name', 'ok']);
            expect(typeof item.name).toBe('string');
            expect(typeof item.ok).toBe('boolean');
            expect(item.error === null || typeof item.error === 'string').toBe(true);
            expect(item.ok).toBe(item.error === null);
        }
        expect(report.passed).toBe(report.cases.filter((item) => item.ok).length);
        expect(report.failed).toBe(report.cases.filter((item) => !item.ok).length);
        expect(report.failed).toBe(0);
        expect(result.status).toBe(0);
    });
});
