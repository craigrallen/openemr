'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const contractPath = path.resolve(__dirname, '../clinical-ui/billing-search-spinner-name-contract.cjs');
const expectedNames = [
    'fixture pinned SHA-256',
    'fixture has exactly one original heading',
    'original fixture fails semantic linkage',
    'corrected fixture passes semantics',
    'corrected fixture preserves all other bytes',
    'missing aria linkage fails semantics',
    'wrong heading target fails semantics',
    'duplicate label targets fail semantics',
    'off-modal label target fails semantics',
    'unrelated native caller edit fails preservation',
    'unrelated PHP edit fails preservation',
    'live native launcher unchanged',
    'live modal root role and label',
    'live static backdrop',
    'live keyboard setting',
    'live Loading status text',
    'live translated Searching heading unchanged',
    'live unique heading is contained label target',
    'live source has only approved insertion'
];

describe('billing search spinner accessible name source contract', () => {
    test('reports every fixed case as passing', () => {
        const child = spawnSync(process.execPath, [contractPath], {
            encoding: 'utf8',
            timeout: 15000
        });

        expect(child.error).toBeUndefined();
        expect(child.signal).toBeNull();
        expect(child.status).not.toBeNull();
        expect(child.status).toBe(0);
        expect(child.stderr).toBe('');
        expect(typeof child.stdout).toBe('string');
        expect(child.stdout).toMatch(/^[^\r\n]+\n(?![\s\S])/);

        const report = JSON.parse(child.stdout.slice(0, -1));
        expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed']);
        expect(Array.isArray(report.cases)).toBe(true);
        expect(report.cases).toHaveLength(expectedNames.length);
        expect(report.cases.map((item) => item.name).sort()).toEqual([...expectedNames].sort());
        expect(new Set(report.cases.map((item) => item.name)).size).toBe(expectedNames.length);
        for (const item of report.cases) {
            expect(Object.keys(item).sort()).toEqual(['name', 'ok']);
            expect(typeof item.name).toBe('string');
            expect(typeof item.ok).toBe('boolean');
            expect(item.ok).toBe(true);
        }
        expect(Number.isInteger(report.passed)).toBe(true);
        expect(Number.isInteger(report.failed)).toBe(true);
        expect(report.passed).toBe(expectedNames.length);
        expect(report.failed).toBe(0);
        expect(report.passed + report.failed).toBe(report.cases.length);
    });
});
