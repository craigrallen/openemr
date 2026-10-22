/**
 * @jest-environment node
 */

// The procedure provider guard is a dependency-free node:test file; Jest runs it in a child process.
const path = require('path');
const { spawnSync } = require('child_process');
const process = require('node:process');

const repo = path.join(__dirname, '../..');
const guard = 'tests/clinical-ui/procedure-provider.test.cjs';

test('procedure provider presentation guard passes under node --test', () => {
    const run = spawnSync(process.execPath, ['--test', guard], { cwd: repo, encoding: 'utf8' });
    expect(run.error).toBeUndefined();
    expect({ status: run.status, output: run.status === 0 ? '' : `${run.stdout}${run.stderr}` }).toEqual({ status: 0, output: '' });
});
