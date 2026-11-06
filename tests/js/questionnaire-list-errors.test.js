'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const fixture = path.resolve(__dirname, '../clinical-ui/questionnaire-list-errors.php.fixture');

describe('OPEMR-227 Questionnaire list error routing', () => {
    test('native public list fixture', () => {
        expect(fs.existsSync(fixture)).toBe(true);
        const run = spawnSync('php', [fixture], {
            encoding: 'utf8',
            timeout: 30000,
            maxBuffer: 1024 * 1024,
            windowsHide: true,
        });
        expect(run.error).toBeUndefined();
        expect(run.signal).toBeNull();
        expect(run.status).toBe(0);
        expect(run.stderr).toBe('');
        expect(run.stdout).toMatch(/^\{[^\r\n]*\}\n(?![\s\S])/);
        const report = JSON.parse(run.stdout);
        expect(Object.keys(report).sort()).toEqual(['failed', 'failures', 'passed', 'total']);
        expect(Number.isInteger(report.total)).toBe(true);
        expect(Number.isInteger(report.passed)).toBe(true);
        expect(Number.isInteger(report.failed)).toBe(true);
        expect(Array.isArray(report.failures)).toBe(true);
        expect(report.total).toBe(19);
        expect(report.passed + report.failed).toBe(report.total);
        expect(report.failures.length).toBe(report.failed);
        expect(report.failures.every((failure) =>
            Object.keys(failure).sort().join(',') === 'message,name'
            && typeof failure.name === 'string'
            && typeof failure.message === 'string'
        )).toBe(true);
        expect(report.passed).toBe(19);
        expect(report.failed).toBe(0);
        expect(report.failures).toEqual([]);
    });
});
