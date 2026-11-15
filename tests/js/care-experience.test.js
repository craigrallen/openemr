const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const ORIGINAL_SHA256 = 'fe9d46d2114820ed55feed0ead928dffaad80a818c0031155cd876cf5f52d659';

function inspectFixture(result) {
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
    expect(result.stdout).toMatch(/^[^\r\n]*\n(?![\s\S])/);

    const report = JSON.parse(result.stdout.slice(0, -1));
    expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed', 'source_sha256', 'total']);
    expect(report.source_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(report.source_sha256).not.toBe(ORIGINAL_SHA256);
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
    expect(report.passed).toBe(report.cases.filter((item) => item.pass).length);
    expect(report.failed).toBe(report.cases.filter((item) => !item.pass).length);
    expect(result.status).toBe(report.failed === 0 ? 0 : 1);
    expect(report.failed).toBe(0);
    expect(report.cases.every((item) => item.pass)).toBe(true);
}

test('native care experience value contract', () => {
    const result = spawnSync('php', ['tests/clinical-ui/care-experience-contract.php.fixture'], {
        cwd: ROOT,
        encoding: 'utf8',
    });
    inspectFixture(result);
});
