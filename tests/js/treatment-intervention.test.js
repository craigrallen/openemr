const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const ORIGINAL_SHA256 = 'c9f00160fa6d0044c2df329dc4f6341b728c3918bb6da79cb8248f8c2163472c';

function inspectFixture(result) {
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
    expect(result.stdout).toMatch(/^[^\r\n]*\n(?![\s\S])/);

    const report = JSON.parse(result.stdout.slice(0, -1));
    expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed', 'source_sha256', 'total']);
    expect(report.source_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.cases.length).toBe(13);
    expect(Number.isInteger(report.total)).toBe(true);
    expect(Number.isInteger(report.passed)).toBe(true);
    expect(Number.isInteger(report.failed)).toBe(true);
    expect(report.total).toBe(report.cases.length);
    expect(report.passed + report.failed).toBe(report.total);

    const names = new Set();
    for (const item of report.cases) {
        expect(Object.keys(item).sort()).toEqual(['message', 'name', 'pass']);
        expect(typeof item.name).toBe('string');
        expect(item.name.length).toBeGreaterThan(0);
        expect(names.has(item.name)).toBe(false);
        names.add(item.name);
        expect(typeof item.pass).toBe('boolean');
        expect(typeof item.message).toBe('string');
    }
    expect([...names].sort()).toEqual([
        'source_exact_inverse', 'native_service_loads', 'text_zero_native_object',
        'text_zero_decoded_json', 'text_normal_preserved', 'text_whitespace_preserved',
        'text_missing_omitted', 'text_null_omitted', 'text_empty_omitted',
        'boolean_false_unchanged', 'boolean_true_unchanged', 'coded_value_unchanged',
        'native_transform_row_zero',
    ].sort());
    expect(report.passed).toBe(report.cases.filter((item) => item.pass).length);
    expect(report.failed).toBe(report.cases.filter((item) => !item.pass).length);
    expect(result.status).toBe(report.failed === 0 ? 0 : 1);

    const sourceCase = report.cases.find((item) => item.name === 'source_exact_inverse');
    expect(sourceCase).toBeDefined();
    if (report.source_sha256 === ORIGINAL_SHA256) {
        expect(sourceCase.pass).toBe(true);
    }
    expect(report.failed).toBe(0);
    expect(report.cases.every((item) => item.pass)).toBe(true);
}

test('native treatment intervention value contract', () => {
    const result = spawnSync('php', ['tests/clinical-ui/treatment-intervention-contract.php.fixture'], {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 30000,
        maxBuffer: 1024 * 1024,
    });
    inspectFixture(result);
});
