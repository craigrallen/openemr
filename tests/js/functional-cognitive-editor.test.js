/* global test */
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Functional/Cognitive Status portable source contract passes completely', () => {
    const root = path.resolve(__dirname, '../..');
    const child = spawnSync(process.execPath,
        ['--test-reporter=tap', path.join(root, 'tests/clinical-ui/functional-cognitive-editor-contract.cjs')],
        { cwd: root, encoding: 'utf8', timeout: 30000 });
    const output = `${child.stdout || ''}\n${child.stderr || ''}`;
    const counts = Object.fromEntries(['tests', 'pass', 'fail'].map((label) => {
        const match = output.match(new RegExp(`^# ${label} (\\d+)$`, 'm'));
        return [label, match ? Number(match[1]) : NaN];
    }));
    if (child.error || child.status !== 0 || !Number.isInteger(counts.tests)
        || counts.tests < 1 || counts.pass !== counts.tests || counts.fail !== 0) {
        throw new Error(`Functional/Cognitive Status contract failed (exit ${child.status}):\n${output}`);
    }
});
