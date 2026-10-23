/** @jest-environment node */
'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('CAMOS help source contract passes native node:test TAP without skips', () => {
    const root = path.resolve(__dirname, '../..');
    const file = path.join(root, 'tests/clinical-ui/camos-help-contract.cjs');
    const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null, result.stderr);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /^TAP version 13\n/);
    assert.match(result.stdout, /^# tests 5$/m);
    assert.match(result.stdout, /^# pass 5$/m);
    assert.match(result.stdout, /^# fail 0$/m);
    assert.match(result.stdout, /^# skipped 0$/m);
    assert.match(result.stdout, /^# todo 0$/m);
});
