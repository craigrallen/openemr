'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Configure Orders help popup contracts', () => {
    const contract = path.join(__dirname, 'contracts/configure-orders-help-popup.cjs');
    const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', contract], {
        cwd: path.resolve(__dirname, '../..'),
        encoding: 'utf8'
    });
    expect(run.error).toBeUndefined();
    expect(run.signal).toBeNull();
    expect(run.stdout).toContain('TAP version 13');
    expect(run.stdout).toContain('live route implements the exact Configure Orders workbench presentation seam');
    expect(run.status).toBe(0);
});
