'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const contractPath = path.resolve(__dirname, '../clinical-ui/weno-debug-popup-contract.cjs');
const expectedNames = [
    'fixture SHA-256 matches frozen original',
    'original native modal and callers remain identifiable',
    'positive candidate has exact scoped screen semantics',
    'positive candidate preserves every original byte',
    'original source lacks proposed style semantics',
    'live source has proposed style semantics',
    'live inverse matches frozen original SHA-256',
    'missing screen media is rejected',
    'missing workbench context is rejected',
    'missing modal scope is rejected',
    'added focus rule is rejected',
    'added paint declaration is rejected',
    'missing title min-width is rejected',
    'missing title wrapping is rejected',
    'missing close flex-shrink is rejected',
    'missing body wrapping is rejected',
    'missing download width is rejected',
    'missing download wrapping is rejected',
    'missing footer margin budget is rejected',
    'missing footer wrapping is rejected',
    'duplicate style fails inverse',
    'moved style fails unique placement',
    'PHP edit fails inverse',
    'JavaScript edit fails inverse',
    'iframe edit fails inverse',
    'download attribute edit fails inverse',
    'translation edit fails inverse'
];

describe('Weno debug popup source contract', () => {
    test('reports the complete passing contract', () => {
        const result = spawnSync(process.execPath, [contractPath], {
            encoding: 'utf8',
            timeout: 15000
        });
        expect(result.error).toBeUndefined();
        expect(result.signal).toBeNull();
        expect(result.status).not.toBeNull();
        expect(result.status).toBe(0);
        expect(result.stderr).toBe('');
        expect(typeof result.stdout).toBe('string');
        expect(result.stdout).toMatch(/\n(?![\s\S])/);
        expect(result.stdout.indexOf('\n')).toBe(result.stdout.length - 1);
        const report = JSON.parse(result.stdout.slice(0, -1));
        expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed']);
        expect(Number.isInteger(report.passed)).toBe(true);
        expect(Number.isInteger(report.failed)).toBe(true);
        expect(Array.isArray(report.cases)).toBe(true);
        expect(report.cases).toHaveLength(expectedNames.length);
        expect(new Set(expectedNames).size).toBe(expectedNames.length);
        expect(report.cases.map((item) => item.name)).toEqual(expectedNames);
        for (const item of report.cases) {
            expect(Object.keys(item).sort()).toEqual(['name', 'ok']);
            expect(typeof item.name).toBe('string');
            expect(item.ok).toBe(true);
        }
        expect(report.passed).toBe(expectedNames.length);
        expect(report.failed).toBe(0);
        assert.equal(report.passed + report.failed, report.cases.length);
    });
});
