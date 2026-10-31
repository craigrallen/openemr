const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('portable calendar patient picker keyboard contract passes', () => {
    const contract = path.join(__dirname, '../clinical-ui/calendar-patient-picker-keyboard-contract.cjs');
    const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', contract], { encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/# pass 5/);
    expect(result.stdout).toMatch(/# fail 0/);
    expect(result.stdout).not.toMatch(/^not ok /m);
});
