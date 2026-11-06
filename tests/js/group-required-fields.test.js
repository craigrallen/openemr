const path = require('path');
const { spawnSync } = require('child_process');

test('patient provider Group has required native fields and preserves its mapping', () => {
  const root = path.resolve(__dirname, '../..');
  const fixture = path.join(root, 'tests/clinical-ui/group-required-fields.php.fixture');
  const result = spawnSync('php', [fixture], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  });

  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.signal).toBeNull();
  expect(result.stderr).toBe('');
  expect(result.stdout).toMatch(/^\{[^\r\n]*\}\n(?![\s\S])/);

  const report = JSON.parse(result.stdout);
  expect(Object.keys(report).sort()).toEqual(['cases', 'errors', 'failed', 'source_sha256', 'total']);
  expect(report.source_sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(report.errors).toEqual([]);
  expect(report.failed).toBe(0);
  expect(report.total).toBe(7);
  expect(Array.isArray(report.cases)).toBe(true);
  expect(report.cases).toHaveLength(7);
  expect(report.cases.map(({ name }) => name)).toEqual([
    'whole-source inverse',
    'real mapper reflection',
    'missing patients',
    'null patients',
    'empty patients',
    'one patient',
    'two patients and encode contract',
  ]);
  for (const entry of report.cases) {
    expect(Object.keys(entry).sort()).toEqual(['error', 'name', 'ok']);
    expect(entry.ok).toBe(true);
    expect(entry.error).toBeNull();
  }
});
