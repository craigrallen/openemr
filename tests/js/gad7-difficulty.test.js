const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('portable native GAD-7 difficulty contract', () => {
    const contract = path.resolve(__dirname, '../clinical-ui/gad7-difficulty-contract.cjs');
    const result = spawnSync(process.execPath, [contract], { encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
    expect(result.stdout.trim()).not.toBe('');
    let report;
    try { report = JSON.parse(result.stdout.trim()); }
    catch (error) { throw new Error(`Invalid contract JSON: ${error.message}`); }
    expect(report.count).toBe(11);
    expect(Array.isArray(report.failures)).toBe(true);
    if (result.status !== 0 || report.failures.length !== 0) {
        throw new Error(`GAD-7 contract exited ${result.status}: ${JSON.stringify(report.failures)}`);
    }
});
