/** @jest-environment node */

// Runs the portable, dependency-free template question checks under node:test.
// The history check (template-question-history.cjs) is local and explicit only.

const { spawnSync } = require('child_process');
const path = require('path');

test('portable template question popup checks pass', () => {
    const file = path.join(__dirname, '../clinical-ui/template-question.cjs');
    const result = spawnSync(process.execPath, ['--test', file], { encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error(`node --test failed (${result.status})\n${result.stdout}\n${result.stderr}`);
    }
    expect(result.status).toBe(0);
});
