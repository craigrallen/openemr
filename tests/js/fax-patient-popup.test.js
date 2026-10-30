/** @jest-environment node */
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PLAN } = require('../clinical-ui/fax-patient-popup-contract.cjs');

test('fax patient popup static contract passes in Node', () => {
    const root = path.resolve(__dirname, '../..');
    const contract = path.join(root, 'tests/clinical-ui/fax-patient-popup-contract.cjs');
    const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', contract], {
        cwd: root,
        encoding: 'utf8',
        env: process.env,
    });
    const output = `${run.stdout || ''}\n${run.stderr || ''}`;
    const number = label => Number(output.match(new RegExp(`^# ${label} (\\d+)$`, 'm'))?.[1]);
    expect(run.error).toBeUndefined();
    expect(number('tests')).toBe(PLAN.length);
    expect(number('pass')).toBe(PLAN.length);
    expect(number('fail')).toBe(0);
    expect(number('skipped')).toBe(0);
    expect(run.status).toBe(0);
});
