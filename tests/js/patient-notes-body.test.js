/** @jest-environment node */
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const suite = path.resolve(__dirname, '../clinical-ui/patient-notes-body-contract.cjs');

test('portable patient notes body contract passes every case', () => {
    const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', suite], {
        encoding: 'utf8',
        timeout: 30000
    });
    if (result.error) throw result.error;
    const report = result.stdout + result.stderr;
    assert.equal(result.status, 0, report);
    assert.doesNotMatch(report, /^not ok /m);
    assert.match(report, /^# tests 25$/m);
    assert.match(report, /^# pass 25$/m);
    assert.match(report, /^# fail 0$/m);
});
