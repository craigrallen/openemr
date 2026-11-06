'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const fixture = path.resolve(__dirname, '../clinical-ui/questionnaire-search-event.php.fixture');

test('OPEMR-224 native QuestionnaireResponse search event fixture', () => {
    expect(fs.existsSync(fixture)).toBe(true);
    const run = spawnSync('php', [fixture], { encoding: 'utf8' });
    expect(run.error).toBeUndefined();
    expect(run.status).toBe(0);
    expect(run.stderr).toBe('');
    expect(run.stdout).toMatch(/^\{[^\r\n]*\}\n(?![\s\S])/);
    const report = JSON.parse(run.stdout);
    expect(Object.keys(report).sort()).toEqual(['failed', 'failures', 'passed', 'total']);
    expect(Number.isInteger(report.total)).toBe(true);
    expect(Number.isInteger(report.passed)).toBe(true);
    expect(Number.isInteger(report.failed)).toBe(true);
    expect(Array.isArray(report.failures)).toBe(true);
    expect(report.total).toBe(15);
    expect(report.passed).toBe(report.total);
    expect(report.failed).toBe(0);
    expect(report.failures).toEqual([]);
});
