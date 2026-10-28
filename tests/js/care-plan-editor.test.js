/* global __dirname, test */
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Care Plan portable source contract passes completely', () => {
    const root = path.resolve(__dirname, '../..');
    const child = spawnSync(process.execPath,
        ['--test-reporter=tap', path.join(root, 'tests/clinical-ui/care-plan-editor-contract.cjs')],
        { cwd: root, encoding: 'utf8', timeout: 30000 });
    const output = `${child.stdout || ''}\n${child.stderr || ''}`;
    const count = output.match(/^# tests (\d+)$/m);
    const passed = output.match(/^# pass (\d+)$/m);
    const failed = output.match(/^# fail (\d+)$/m);
    if (child.error || child.status !== 0 || !count || !passed || !failed
        || Number(count[1]) !== 7 || Number(passed[1]) !== 7
        || Number(failed[1]) !== 0) {
        throw new Error(`Care Plan source contract failed (exit ${child.status}):\n${output}`);
    }
});
