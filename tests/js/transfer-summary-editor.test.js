/* global test */
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Transfer Summary portable source contract passes completely', () => {
    const root = path.resolve(__dirname, '../..');
    const child = spawnSync(process.execPath,
        ['--test', '--test-reporter=tap', path.join(root, 'tests/clinical-ui/transfer-summary-editor-contract.cjs')],
        { cwd: root, encoding: 'utf8', timeout: 30000 });
    const output = `${child.stdout || ''}\n${child.stderr || ''}`;
    const declared = [...output.matchAll(/^\s*\d+\.\.([0-9]+)$/gm)].map((match) => Number(match[1]));
    const statuses = [...output.matchAll(/^\s*(ok|not ok)\s+([0-9]+)\s+/gm)];
    const counts = Object.fromEntries(['tests', 'pass', 'fail'].map((label) => {
        const match = output.match(new RegExp(`^# ${label} (\\d+)$`, 'm'));
        return [label, match ? Number(match[1]) : NaN];
    }));
    const numbered = statuses.every((match, index) => Number(match[2]) === index + 1);
    const passed = statuses.every((match) => match[1] === 'ok');
    if (child.error || child.status !== 0 || declared.length !== 1
        || !Number.isInteger(counts.tests) || counts.tests < 1
        || declared[0] !== counts.tests || statuses.length !== counts.tests
        || !numbered || !passed || counts.pass !== counts.tests || counts.fail !== 0) {
        throw new Error(`Transfer Summary contract failed (exit ${child.status}):\n${output}`);
    }
});
