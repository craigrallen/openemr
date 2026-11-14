const path = require('node:path');
const {spawnSync} = require('node:child_process');

const names = [
    'fixture checksum and original roots',
    'actual source has exactly two approved root labels',
    'actual source reverses to original fixture bytes',
    'close caller selects existing root and constructs Bootstrap.Modal',
    'configure caller selects existing root and constructs Bootstrap.Modal',
    'mutation rejects missing close label',
    'mutation rejects missing configure label',
    'mutation rejects duplicate root',
    'mutation rejects child-only label',
    'mutation rejects swapped labels',
    'mutation rejects wrong escaping filter',
    'mutation rejects appointment status drift',
    'mutation rejects checkbox behavior drift',
    'mutation rejects fixture tamper'
];

test('telehealth session modal names contract', () => {
    const script = path.resolve(__dirname, '..', 'clinical-ui', 'telehealth-session-modal-names-contract.cjs');
    const result = spawnSync(process.execPath, [script], {encoding: 'utf8'});
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
    expect(result.stdout).toMatch(/^(\{[^\n]*\})\n(?![\s\S])/);
    const report = JSON.parse(result.stdout.slice(0, -1));
    expect(Object.keys(report).sort()).toEqual(['cases', 'exitStatus', 'failed', 'passed']);
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.cases).toHaveLength(names.length);
    expect(report.cases.map(item => item.name)).toEqual(names);
    report.cases.forEach(item => {
        expect(Object.keys(item).sort()).toEqual(['name', 'passed']);
        expect(typeof item.name).toBe('string');
        expect(typeof item.passed).toBe('boolean');
    });
    expect(Number.isInteger(report.passed)).toBe(true);
    expect(Number.isInteger(report.failed)).toBe(true);
    expect(Number.isInteger(report.exitStatus)).toBe(true);
    expect(report.passed + report.failed).toBe(names.length);
    expect(report.passed).toBe(report.cases.filter(item => item.passed).length);
    expect(report.failed).toBe(report.cases.filter(item => !item.passed).length);
    expect(report.exitStatus).toBe(0);
    expect(result.status).toBe(0);
    expect(report.failed).toBe(0);
});
