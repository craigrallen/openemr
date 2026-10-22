/**
 * @jest-environment node
 */
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const root = join(__dirname, '../..');

test('Portal openings popup source contracts', () => {
    const args = ['--test', join(root, 'tests/clinical-ui/portal-openings-popup.test.cjs')];
    if (process.argv.includes('--history')) args.push('--history');
    const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    if (result.status !== 0) {
        throw new Error('Portal openings source contracts failed:\n' + result.stdout + '\n' + result.stderr);
    }
});
