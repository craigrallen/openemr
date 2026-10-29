/* global __dirname, test */
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');

test('prior authorization portable source contract passes completely', () => {
    const child = spawnSync(process.execPath,
        ['--test-reporter=tap', path.join(root, 'tests/clinical-ui/prior-auth-editor-contract.cjs')],
        { cwd: root, encoding: 'utf8', timeout: 30000 });
    const output = `${child.stdout || ''}\n${child.stderr || ''}`;
    const plans = [...output.matchAll(/^1\.\.(\d+)$/gm)];
    const counts = [...output.matchAll(/^# tests (\d+)$/gm)];
    const passed = [...output.matchAll(/^# pass (\d+)$/gm)];
    const failed = [...output.matchAll(/^# fail (\d+)$/gm)];
    const enumerated = [...output.matchAll(/^(not ok|ok) (\d+) - .+$/gm)];
    const total = plans.length === 1 ? Number(plans[0][1]) : 0;
    const valid = !child.error && child.status === 0 && /^TAP version 13$/m.test(output)
        && total > 0 && counts.length === 1 && Number(counts[0][1]) === total
        && passed.length === 1 && Number(passed[0][1]) === total
        && failed.length === 1 && Number(failed[0][1]) === 0
        && enumerated.length === total
        && enumerated.every((match, index) => match[1] === 'ok' && Number(match[2]) === index + 1);
    if (!valid) throw new Error(`Prior authorization source contract failed (exit ${child.status}):\n${output}`);
});
