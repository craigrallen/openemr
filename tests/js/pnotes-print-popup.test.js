/** @jest-environment node */

// OPEMR-46: runs the dependency-free node:test contract under Jest. The
// optional local-history checks are switched off so hosted shallow clones
// stay portable.

const { spawnSync } = require('child_process');
const path = require('path');

const contract = path.join(__dirname, '../clinical-ui/pnotes-print-popup.test.cjs');

test('patient note print popup contract passes under node --test', () => {
    const env = { ...process.env };
    delete env.PNOTES_PRINT_HISTORY;
    const run = spawnSync(process.execPath, ['--test', contract], {
        cwd: path.join(__dirname, '../..'),
        encoding: 'utf8',
        env,
    });
    if (run.status !== 0) {
        throw new Error(`node --test exited ${run.status}\n${run.stdout}\n${run.stderr}`);
    }
    expect(run.status).toBe(0);
});
