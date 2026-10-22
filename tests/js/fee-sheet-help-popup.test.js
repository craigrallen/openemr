'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Fee Sheet help popup source contracts', () => {
    const contract = path.join(__dirname, 'contracts/fee-sheet-help-popup.cjs');
    const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', contract], {
        cwd: path.resolve(__dirname, '../..'),
        encoding: 'utf8'
    });
    expect(run.error).toBeUndefined();
    expect(run.signal).toBeNull();
    expect(run.stdout).toContain('TAP version 13');
    expect(run.stdout).toContain('synthetic future candidate passes before the live RED assertion');
    expect(run.stdout).toContain('live route has the exact Fee Sheet presentation seam');
    expect(run.status).toBe(0);
});
