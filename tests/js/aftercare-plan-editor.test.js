/* global test */
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('AfterCare Planning portable source contract passes completely', () => {
    const root = path.resolve(__dirname, '../..');
    const child = spawnSync(process.execPath,
        ['--test', '--test-reporter=tap', path.join(root, 'tests/clinical-ui/aftercare-plan-editor-contract.cjs')],
        { cwd: root, encoding: 'utf8', timeout: 30000 });
    const output = `${child.stdout || ''}\n${child.stderr || ''}`;
    const declared = [...output.matchAll(/^\s*\d+\.\.([0-9]+)$/gm)].map((match) => Number(match[1]));
    const enumerated = [...output.matchAll(/^\s*(?:ok|not ok)\s+([0-9]+)\s+/gm)].map((match) => Number(match[1]));
    const statuses = [...output.matchAll(/^\s*(ok|not ok)\s+([0-9]+)\s+/gm)];
    const counts = Object.fromEntries(['tests', 'pass', 'fail'].map((label) => {
        const match = output.match(new RegExp(`^# ${label} (\\d+)$`, 'm'));
        return [label, match ? Number(match[1]) : NaN];
    }));
    const numbering = enumerated.every((number, index) => number === index + 1);
    const passed = statuses.every((match) => match[1] === 'ok');
    if (child.error || child.status !== 0 || declared.length !== 1
        || !Number.isInteger(counts.tests) || counts.tests < 1
        || declared[0] !== counts.tests || enumerated.length !== counts.tests
        || !numbering || !passed || counts.pass !== counts.tests || counts.fail !== 0) {
        throw new Error(`AfterCare Planning contract failed (exit ${child.status}):\n${output}`);
    }
});
