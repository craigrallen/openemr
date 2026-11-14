'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('New List modal name source contract', () => {
    const repo = path.resolve(__dirname, '../..');
    const contract = path.join(repo, 'tests/clinical-ui/new-list-modal-name-contract.cjs');
    const result = spawnSync(process.execPath, [contract], { cwd: repo, encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toMatch(/^\{[^\r\n]*\}\n(?![\s\S])/);
    const report = JSON.parse(result.stdout);
    expect(Object.keys(report).sort()).toEqual(['failed', 'failures', 'passed', 'tests']);
    expect(report.tests).toBe(22);
    expect(report.passed).toBe(report.tests);
    expect(report.failed).toBe(0);
    expect(report.failures).toEqual([]);
});
