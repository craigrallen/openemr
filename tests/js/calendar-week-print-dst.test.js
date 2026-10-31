const path = require('path');
const { spawnSync } = require('child_process');

const expectedNames = [
    'stockholm_fall',
    'new_york_fall',
    'stockholm_spring',
    'new_york_spring',
    'utc_no_dst',
    'leap_day',
    'month_rollover',
    'year_rollover_four_row_cap',
    'missing_right_date',
    'invalid_date_fallback',
];
const EXPECTED_CASE_COUNT = 10;

test('native week print calendar day pairing across time boundaries', () => {
    const fixture = path.resolve(__dirname, '../clinical-ui/calendar-week-print-dst.php.fixture');
    const result = spawnSync('php', [fixture], { encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
    expect([0, 1]).toContain(result.status);
    let report;
    expect(() => { report = JSON.parse(result.stdout); }).not.toThrow();
    expect(Object.keys(report).sort()).toEqual(['cases', 'fail', 'pass', 'total']);
    expect(report.total).toBe(EXPECTED_CASE_COUNT);
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.cases).toHaveLength(EXPECTED_CASE_COUNT);
    expect(new Set(report.cases.map(item => item.name)).size).toBe(EXPECTED_CASE_COUNT);
    expect(report.cases.map(item => item.name)).toEqual(expectedNames);
    for (const item of report.cases) {
        expect(['pass', 'fail']).toContain(item.status);
        expect(Object.keys(item).sort()).toEqual(item.status === 'pass'
            ? ['name', 'status'] : ['error', 'name', 'status']);
    }
    expect(report.pass + report.fail).toBe(EXPECTED_CASE_COUNT);
    expect(report.pass).toBe(report.cases.filter(item => item.status === 'pass').length);
    expect(report.fail).toBe(report.cases.filter(item => item.status === 'fail').length);
    expect(report.fail).toBe(0);
    expect(report.pass).toBe(EXPECTED_CASE_COUNT);
    expect(result.status).toBe(0);
});
