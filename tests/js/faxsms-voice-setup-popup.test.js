/** @jest-environment node */
// Hosted Jest adapter for the dependency-free node:test contract.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('OPEMR-183 voice setup popup source contract passes its TAP suite', () => {
  const contract = path.resolve(__dirname, '../clinical-ui/faxsms-voice-setup-popup-contract.cjs');
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', contract], {
    encoding: 'utf8',
    cwd: path.resolve(__dirname, '../..'),
  });
  assert.ifError(run.error);
  const tap = run.stdout;
  const summary = (name) => {
    const matches = [...tap.matchAll(new RegExp(`^# ${name} (\\d+)$`, 'gm'))];
    assert.equal(matches.length, 1, `missing or duplicate TAP ${name} summary`);
    return Number(matches[0][1]);
  };
  const plan = [...tap.matchAll(/^1\.\.(\d+)$/gm)];
  assert.equal(plan.length, 1, 'TAP must have exactly one plan');
  const total = summary('tests');
  const passed = summary('pass');
  const failed = summary('fail');
  assert.ok(total > 0, 'TAP must report positive test count');
  assert.equal(Number(plan[0][1]), total, 'TAP plan and total must match');
  assert.equal(passed, total, 'all reported tests must pass');
  assert.equal(failed, 0, 'TAP must report zero failures');
  assert.equal(run.status, 0, `node:test failed:\n${tap}\n${run.stderr}`);
});
