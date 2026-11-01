/** @jest-environment node */

const path = require('path');
const { spawnSync } = require('child_process');

test('native Immunization dose and optional site contract', () => {
    const root = path.join(__dirname, '../..');
    const fixture = path.join(root, 'tests/clinical-ui/fixtures/immunization-dose-site.php.fixture');
    const result = spawnSync('php', [fixture], { cwd: root, encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const report = JSON.parse(result.stdout);
    expect(report).toEqual({ expected: 24, passed: 24, failed: [] });
});
