const path = require('node:path');
const {spawnSync} = require('node:child_process');

const names = [
    'native Header context source linkage',
    'original source preservation',
    'screen scoped theme preserving sheet',
    'floated tab content clearfix',
    'wrapped actions and long labels',
    'button and tab keyboard focus fallbacks',
    'semantic mutations rejected',
    'preservation mutations rejected'
];

test('transaction editor source contract reports every case green', () => {
    const repository = path.resolve(__dirname, '../..');
    const contract = path.resolve(repository, 'tests/clinical-ui/transaction-editor-contract.cjs');
    const result = spawnSync(process.execPath, [contract], {
        cwd: repository,
        encoding: 'utf8',
        timeout: 30000
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
    expect(result.stdout).toMatch(/^[^\r\n]*\n(?![\s\S])/);
    const report = JSON.parse(result.stdout.slice(0, -1));
    expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed', 'total']);
    expect(Number.isInteger(report.total)).toBe(true);
    expect(Number.isInteger(report.passed)).toBe(true);
    expect(Number.isInteger(report.failed)).toBe(true);
    expect(report.total).toBe(names.length);
    expect(report.passed).toBe(names.length);
    expect(report.failed).toBe(0);
    expect(report.passed + report.failed).toBe(report.total);
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.cases).toHaveLength(names.length);
    expect(report.cases.map(item => item.name).sort()).toEqual([...names].sort());
    for (const item of report.cases) {
        expect(Object.keys(item).sort()).toEqual(['name', 'passed']);
        expect(typeof item.name).toBe('string');
        expect(typeof item.passed).toBe('boolean');
        expect(item.passed).toBe(true);
    }
    expect(result.status).toBe(0);
});
