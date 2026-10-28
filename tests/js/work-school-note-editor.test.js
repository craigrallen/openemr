/* global __dirname */
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Work/School Note portable source contract passes completely', () => {
    const root = path.resolve(__dirname, '../..');
    const child = spawnSync(process.execPath,
        ['--test-reporter=tap', path.join(root, 'tests/clinical-ui/work-school-note-editor-contract.cjs')],
        { cwd: root, encoding: 'utf8', timeout: 30000 });
    const output = `${child.stdout || ''}\n${child.stderr || ''}`;
    const count = output.match(/^# tests (\d+)$/m);
    const passed = output.match(/^# pass (\d+)$/m);
    const failed = output.match(/^# fail (\d+)$/m);
    if (child.error || child.status !== 0 || !count || !passed || !failed
        || Number(count[1]) !== 9 || Number(passed[1]) !== 9
        || Number(failed[1]) !== 0) {
        throw new Error(`Work/School Note source contract failed (exit ${child.status}):\n${output}`);
    }
});
