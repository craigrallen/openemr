const path = require('path');
const { spawnSync } = require('child_process');

test('native FHIR Appointment end-date contract', () => {
    const fixture = path.join(__dirname, '../clinical-ui/fhir-appointment-end-contract.php.fixture');
    const result = spawnSync('php', [fixture], {
        cwd: path.join(__dirname, '../..'),
        encoding: 'utf8',
        timeout: 15000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    const success = '{"ok":true,"count":16}\n';
    expect(result.stdout).toBe(success);
    expect(JSON.parse(result.stdout).count).toBeGreaterThan(0);
    expect(result.stderr).toBe('');
});
