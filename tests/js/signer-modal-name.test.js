'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '../..');
const contract = path.join(repo, 'tests/clinical-ui/signer-modal-name-contract.cjs');
const portableCount = 12;

test('portable signer modal name contract passes', () => {
    const result = spawnSync(process.execPath, [contract], { cwd: repo, encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^\{[^\r\n]*\}\n$/);
    const report = JSON.parse(result.stdout);
    expect(Object.keys(report).sort()).toEqual(['failed', 'failures', 'passed', 'total']);
    expect(report.total).toBe(portableCount);
    expect(report.passed).toBe(portableCount);
    expect(report.failed).toBe(0);
    expect(report.failures).toEqual([]);
});
