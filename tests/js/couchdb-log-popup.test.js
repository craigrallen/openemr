/**
 * @jest-environment node
 */
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const repo = join(__dirname, '../..');

test('CouchDB log popup source contracts', () => {
    const result = spawnSync(process.execPath,
        ['--test', join(repo, 'tests/clinical-ui/couchdb-log-popup.test.cjs')],
        { cwd: repo, encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    if (result.status !== 0) {
        throw new Error(`CouchDB log source contracts failed:\n${result.stdout}\n${result.stderr}`);
    }
});
