const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const fixture = path.join(root, 'tests/clinical-ui/device-manufacturer-contract.php.fixture');
const source = path.join(root, 'src/Services/FHIR/FhirDeviceService.php');
const names = [
  'source inverse',
  'native provenance',
  'nonempty manufacturers',
  'omitted manufacturers',
  'other fields preserved',
  'writer projected roundtrip',
];

test('native FHIR Device manufacturer contract', () => {
  const result = spawnSync('php', [fixture], { cwd: root, encoding: 'utf8', timeout: 30000 });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.stderr).toBe('');
  const report = JSON.parse(result.stdout);
  expect(Object.keys(report).sort()).toEqual(['cases', 'errors', 'failed', 'source_sha256', 'total']);
  expect(report.errors).toEqual([]);
  expect(report.total).toBe(6);
  expect(report.failed).toBe(0);
  expect(report.cases).toHaveLength(6);
  expect(report.cases.map(({ name }) => name)).toEqual(names);
  expect(new Set(report.cases.map(({ name }) => name)).size).toBe(6);
  for (const item of report.cases) {
    expect(Object.keys(item).sort()).toEqual(['error', 'name', 'ok']);
    expect(typeof item.ok).toBe('boolean');
    expect(item.ok).toBe(true);
    expect(item.error).toBeNull();
  }
  expect(report.source_sha256).toBe(createHash('sha256').update(readFileSync(source)).digest('hex'));
  expect(result.status).toBe(0);
});
