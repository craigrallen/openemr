/* tests/js/portal-payment-modal-name.test.js */
'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('portal payment modal name source contract', () => {
    const repo = path.resolve(__dirname, '../..');
    const contract = path.resolve(repo, 'tests/clinical-ui/portal-payment-modal-name-contract.cjs');
    const child = spawnSync(process.execPath, [contract], { cwd: repo, encoding: 'utf8' });
    expect(child.error).toBeUndefined();
    expect(child.status).toBe(0);
    expect(child.stderr).toBe('');
    const match = /^([^\r\n]+)(?:\r?\n)?$(?![\s\S])/.exec(child.stdout);
    expect(match).not.toBeNull();
    const report = JSON.parse(match[1]);
    expect(Object.keys(report).sort()).toEqual(['failed', 'failures', 'passed', 'tests']);
    expect(report).toEqual({ tests: 11, passed: 11, failed: 0, failures: [] });
});
