'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('native portal read acknowledgement contract', () => {
    const contract = path.resolve(__dirname, '../clinical-ui/portal-message-read-ack-contract.cjs');
    const result = spawnSync(process.execPath, [contract], { encoding: 'utf8', timeout: 15000 });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
});
