const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('native ClinicalNoteParser preserves zero narrative content', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const result = spawnSync('php', ['tests/clinical-ui/clinical-note-zero.php.fixture'], {
        cwd: repoRoot,
        encoding: 'utf8',
    });

    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe('');
    expect(result.stdout).toMatch(/^[^\r\n]*\n(?![\s\S])/);

    const report = JSON.parse(result.stdout.slice(0, -1));
    expect(Object.keys(report).sort()).toEqual(['failed', 'failures', 'passed', 'total']);
    expect(report.total).toBe(18);
    expect(report.passed).toBe(18);
    expect(report.failed).toBe(0);
    expect(Array.isArray(report.failures)).toBe(true);
    expect(report.failures.every((failure) => typeof failure === 'string' && failure.length > 0)).toBe(true);
    expect(report.total).toBe(report.passed + report.failed);
    expect(report.failed).toBe(report.failures.length);

    if (result.status !== 0 || report.failed !== 0) {
        throw new Error(`Native fixture exited ${result.status}: ${report.failures.join('; ')}`);
    }
});
