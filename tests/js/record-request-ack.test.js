const path = require('node:path');
const { spawnSync } = require('node:child_process');

const expectedCases = [
    'source inverse preserves original PHP, SQL, ACL, and CSRF',
    'existing request load makes no submission or reload',
    'pending submission hides request and recorded message',
    'duplicate click submits only once',
    'POST endpoint and metadata remain exact',
    'every HTTP 200 body restores session and reloads without showing recorded',
    'failed POST shows uncertainty without reload or automatic retry',
    'status check restores session and reloads without POST',
    'private response detail is never reflected'
];

test('native Patient Records Request acknowledgement contract', () => {
    const repo = path.resolve(__dirname, '..', '..');
    const contract = path.join(repo, 'tests', 'clinical-ui', 'record-request-ack-contract.cjs');
    const result = spawnSync(process.execPath, [contract], {
        cwd: repo,
        encoding: 'utf8',
        timeout: 30000
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
    expect(result.stdout.endsWith('\n')).toBe(true);
    expect(result.stdout.split('\n')).toHaveLength(2);
    const report = JSON.parse(result.stdout.trimEnd());
    expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed', 'total']);
    expect(report.cases.map(item => item.name)).toEqual(expectedCases);
    expect(report.cases.every(item => typeof item.passed === 'boolean')).toBe(true);
    expect(report.total).toBe(expectedCases.length);
    expect(report.passed + report.failed).toBe(report.total);
    expect(result.status).toBe(0);
    expect(report.failed).toBe(0);
    expect(report.passed).toBe(expectedCases.length);
});
