/* global __dirname, test */
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Observation portable source contract passes completely', () => {
    const root = path.resolve(__dirname, '../..');
    const child = spawnSync(process.execPath,
        ['--test-reporter=tap', path.join(root, 'tests/clinical-ui/observation-editor-contract.cjs')],
        { cwd: root, encoding: 'utf8', timeout: 30000 });
    const output = `${child.stdout || ''}\n${child.stderr || ''}`;
    const plans = [...output.matchAll(/^1\.\.(\d+)$/gm)];
    const counts = [...output.matchAll(/^# tests (\d+)$/gm)];
    const passed = [...output.matchAll(/^# pass (\d+)$/gm)];
    const failed = [...output.matchAll(/^# fail (\d+)$/gm)];
    const skipped = [...output.matchAll(/^# skipped (\d+)$/gm)];
    const todo = [...output.matchAll(/^# todo (\d+)$/gm)];
    const enumerated = [...output.matchAll(/^(not ok|ok) (\d+) - .+$/gm)];
    const declared = 9;
    const valid = !child.error && child.status === 0
        && plans.length === 1 && counts.length === 1 && passed.length === 1 && failed.length === 1
        && Number(plans[0][1]) === declared && Number(counts[0][1]) === declared
        && Number(passed[0][1]) === declared && Number(failed[0][1]) === 0
        && skipped.every((match) => Number(match[1]) === 0)
        && todo.every((match) => Number(match[1]) === 0)
        && enumerated.length === declared
        && enumerated.every((match, index) => match[1] === 'ok' && Number(match[2]) === index + 1);
    if (!valid) throw new Error(`Observation source contract failed (exit ${child.status}):\n${output}`);
});
