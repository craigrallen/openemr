'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('portable OPEMR-45 billing clear popup suite', () => {
    const suite = path.join(__dirname, '../clinical-ui/billing-clear-popup.test.cjs');
    const result = spawnSync(process.execPath, ['--test', suite], {
        encoding: 'utf8',
        env: process.env,
    });
    expect(result.error).toBeUndefined();
    expect(`${result.stdout}\n${result.stderr}`).toContain('synthetic candidate');
    expect(result.status).toBe(0);
});
