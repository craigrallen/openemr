// tests/js/billing-confirm-cancel.test.js
'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');
test('billing confirmation source contract', () => {
    const repo = path.resolve(__dirname, '../..');
    const contract = path.resolve(__dirname, '../clinical-ui/billing-confirm-cancel-contract.cjs');
    const child = spawnSync(process.execPath, [contract], { cwd: repo, encoding: 'utf8' });
    expect(child.status).toBe(0);
    expect(child.stderr).toBe('');
    const frame = /^([^\r\n]+)(?:\r?\n)?(?![\s\S])/.exec(child.stdout);
    expect(frame).not.toBeNull();
    const result = JSON.parse(frame[1]);
    expect(Object.keys(result).sort()).toEqual(['tests', 'passed', 'failed', 'failures'].sort());
    expect(result).toEqual({ tests: 20, passed: 20, failed: 0, failures: [] });
});
