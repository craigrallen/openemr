/* global __dirname */
'use strict';

// Jest is only an adapter. The portable Node contract owns every assertion and
// a RED child run must remain RED here, even if it emitted some passing tests.
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Dictation document source contract passes completely', () => {
    const root = path.resolve(__dirname, '../..');
    const child = spawnSync(process.execPath,
        ['--test-reporter=tap', path.join(root, 'tests/clinical-ui/dictation-editor-contract.cjs')],
        { cwd: root, encoding: 'utf8', timeout: 30000 });
    const output = `${child.stdout || ''}\n${child.stderr || ''}`;
    const count = output.match(/^# tests (\d+)$/m);
    const passed = output.match(/^# pass (\d+)$/m);
    const failed = output.match(/^# fail (\d+)$/m);
    if (child.error || child.status !== 0 || !count || !passed || !failed
        || Number(count[1]) < 1 || Number(passed[1]) !== Number(count[1])
        || Number(failed[1]) !== 0) {
        throw new Error(`Dictation source contract failed (exit ${child.status}):\n${output}`);
    }
});
