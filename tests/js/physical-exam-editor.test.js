/* global __dirname, test */
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('physical exam portable source contract passes completely', () => {
    const root = path.resolve(__dirname, '../..');
    const child = spawnSync(process.execPath,
        ['--test-reporter=tap', path.join(root, 'tests/clinical-ui/physical-exam-editor-contract.cjs')],
        { cwd: root, encoding: 'utf8', timeout: 30000 });
    const output = `${child.stdout || ''}\n${child.stderr || ''}`;
    const expected = 8;
    const plans = [...output.matchAll(/^1\.\.(\d+)$/gm)];
    const counts = [...output.matchAll(/^# tests (\d+)$/gm)];
    const passed = [...output.matchAll(/^# pass (\d+)$/gm)];
    const failed = [...output.matchAll(/^# fail (\d+)$/gm)];
    const skipped = [...output.matchAll(/^# skipped (\d+)$/gm)];
    const todo = [...output.matchAll(/^# todo (\d+)$/gm)];
    const enumerated = [...output.matchAll(/^(not ok|ok) (\d+) - .+$/gm)];
    const valid = !child.error && child.status === 0 && /^TAP version 13$/m.test(output)
        && plans.length === 1 && Number(plans[0][1]) === expected
        && counts.length === 1 && Number(counts[0][1]) === expected
        && passed.length === 1 && Number(passed[0][1]) === expected
        && failed.length === 1 && Number(failed[0][1]) === 0
        && skipped.every((match) => Number(match[1]) === 0)
        && todo.every((match) => Number(match[1]) === 0)
        && enumerated.length === expected
        && enumerated.every((match, index) => match[1] === 'ok' && Number(match[2]) === index + 1);
    if (!valid) throw new Error(`Physical exam source contract failed (exit ${child.status}):\n${output}`);
});
