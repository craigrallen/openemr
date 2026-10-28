/* global test */
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Treatment Planning portable source contract passes completely', () => {
    const root = path.resolve(__dirname, '../..');
    const child = spawnSync(process.execPath,
        ['--test', '--test-reporter=tap', path.join(root, 'tests/clinical-ui/treatment-plan-editor-contract.cjs')],
        { cwd: root, encoding: 'utf8', timeout: 30000 });
    const output = `${child.stdout || ''}\n${child.stderr || ''}`;
    const count = (label) => {
        const matches = [...output.matchAll(new RegExp(`^# ${label} (\\d+)$`, 'gm'))];
        return matches.length === 1 ? Number(matches[0][1]) : NaN;
    };
    const declared = count('tests');
    const passed = count('pass');
    const failed = count('fail');
    const cancelled = count('cancelled');
    const skipped = count('skipped');
    const todo = count('todo');
    const enumerated = (output.match(/^ok \d+ - /gm) || []).length;
    const negative = (output.match(/^not ok \d+ - /gm) || []).length;
    if (child.error || child.signal || child.status !== 0 || declared !== 6
        || passed !== declared || failed !== 0 || cancelled !== 0 || skipped !== 0
        || todo !== 0 || enumerated !== declared || negative !== 0) {
        throw new Error(`Treatment Planning contract failed (exit ${child.status}):\n${output}`);
    }
});
