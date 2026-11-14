'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '../..');
const contract = path.resolve(__dirname, '../clinical-ui/office-note-delete-contract.cjs');
const expectedTests = 19;

test('Office Notes delete source contract', () => {
    const child = spawnSync(process.execPath, [contract], { cwd: repo, encoding: 'utf8' });
    expect(child.error).toBeUndefined();
    expect(child.stderr).toBe('');
    const line = child.stdout.match(/^([^\r\n]+)(?:\r?\n)?(?![\s\S])/);
    expect(line).not.toBeNull();
    const result = JSON.parse(line[1]);
    expect(Object.keys(result).sort()).toEqual(['failed', 'failures', 'passed', 'tests'].sort());
    expect(result).toEqual({ tests: expectedTests, passed: expectedTests, failed: 0, failures: [] });
    expect(child.status).toBe(0);
});
