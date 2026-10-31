/**
 * @jest-environment node
 */

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.join(__dirname, '../..');
const harness = path.join(repo, 'tests/clinical-ui/ccda-preview-single-read.php');

test('native CCDA preview reads and transforms the checked document bytes once', () => {
    const result = spawnSync('php', [harness], {
        cwd: repo,
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 1024 * 1024
    });

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
    expect(result.stdout).toMatch(/^1\.\.9\n/);
    expect((result.stdout.match(/^(?:ok|not ok) - /gm) || [])).toHaveLength(9);
    expect(result.stdout).toMatch(/# cases=9 passed=9 failed=0\n$/);
    expect(result.status).toBe(0);
});
