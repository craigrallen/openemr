'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const expectedNames = [
    'original fixture SHA authentic',
    'actual showOverwriteConfirm caller unchanged',
    'title accessible linkage role backdrop preserved',
    'warning and processed info preserved',
    'escaped pending name and both native actions unchanged',
    'live source has scoped screen layout',
    'full live source exact addition inverse matches original SHA',
    'synthetic minimal addition passes layout',
    'synthetic minimal addition passes preservation',
    'missing screen mutant rejects layout',
    'removed context mutant rejects layout',
    'wrong modal scope mutant rejects layout',
    'missing filename wrap mutant rejects layout',
    'unbounded buttons mutant rejects layout',
    'no footer wrap mutant rejects layout',
    'unrelated PHP edit rejects preservation'
];

test('ERA overwrite popup source contract', () => {
    const contract = path.resolve(__dirname, '../clinical-ui/era-overwrite-popup-contract.cjs');
    const result = spawnSync(process.execPath, [contract], { encoding: 'utf8', timeout: 15000 });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(typeof result.stdout).toBe('string');
    expect(result.stdout).toMatch(/^\{[^\r\n]*\}\n(?![\s\S])/);

    const report = JSON.parse(result.stdout);
    expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed']);
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.cases).toHaveLength(expectedNames.length);
    for (const item of report.cases) {
        expect(Object.keys(item).sort()).toEqual(['name', 'ok']);
        expect(typeof item.name).toBe('string');
        expect(item.ok).toBe(true);
    }
    const names = report.cases.map(item => item.name);
    expect(new Set(names).size).toBe(expectedNames.length);
    expect(names.slice().sort()).toEqual(expectedNames.slice().sort());
    expect(report.passed).toBe(expectedNames.length);
    expect(report.failed).toBe(0);
});
