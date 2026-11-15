const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const fixture = path.join(root, 'tests/clinical-ui/sdoh-observation-errors.php.fixture');
const expectedNames = [
    'source-preservation',
    'internal-error-identity',
    'validation-error-identity',
    'combined-error-partial-data-untouched',
    'success-empty-fresh-result',
    'success-rows-parse-seam',
    'no-code-category-defaults',
    'pregnancy-code-filter',
    'social-history-pregnancy-codes',
    'survey-excludes-pregnancy',
    'conflicting-category-code-skips-backend',
    'malformed-code-native-validation',
    'unrecognized-code-skips-backend',
    'forwarded-filter-identities',
];

test('native SDOH observation search preserves backend errors and filters', () => {
    const run = spawnSync('php', [fixture], {
        cwd: root,
        encoding: 'utf8',
        timeout: 30000,
        maxBuffer: 1024 * 1024,
    });

    expect(run.error).toBeUndefined();
    expect(run.signal).toBeNull();
    expect(run.stderr).toBe('');
    expect(run.stdout).toMatch(/^\{[^\r\n]*\}\n(?![\s\S])/);

    const report = JSON.parse(run.stdout);
    expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed', 'total'].sort());
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.total).toBe(expectedNames.length);
    expect(report.cases).toHaveLength(expectedNames.length);
    expect(report.cases.map(({ name }) => name).sort()).toEqual([...expectedNames].sort());
    expect(new Set(report.cases.map(({ name }) => name)).size).toBe(expectedNames.length);
    for (const item of report.cases) {
        expect(Object.keys(item).sort()).toEqual(['message', 'name', 'passed'].sort());
        expect(item.passed).toBe(true);
        expect(item.message).toBe('');
    }
    expect(report.passed).toBe(expectedNames.length);
    expect(report.failed).toBe(0);
    expect(run.status).toBe(0);
});
