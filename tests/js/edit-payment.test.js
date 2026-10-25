/** @jest-environment node */
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('portable edit payment source contract passes', () => {
    const contract = path.resolve(__dirname, '../clinical-ui/edit-payment-contract.cjs');
    const child = spawnSync(process.execPath, ['--test-reporter=tap', contract], {
        cwd: path.resolve(__dirname, '../..'),
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
    });
    const output = `${child.stdout || ''}\n${child.stderr || ''}`;
    expect(child.error).toBeUndefined();
    expect(output).toMatch(/^# tests 7$/m);
    expect(output).toMatch(/^# pass 7$/m);
    expect(output).toMatch(/^# fail 0$/m);
    expect(child.status).toBe(0);
});
