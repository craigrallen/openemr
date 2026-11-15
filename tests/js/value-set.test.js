const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const fixture = path.join(root, 'tests/clinical-ui/value-set-contract.php.fixture');
const source = path.join(root, 'src/Services/FHIR/FhirValueSetService.php');

function sortedKeys(value) {
  return Object.keys(value).sort();
}

test('OPEMR-241 native ValueSet identity contract', () => {
  const result = spawnSync('php', [fixture], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });

  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.stderr).toBe('');
  expect(typeof result.stdout).toBe('string');
  expect(result.stdout).toMatch(/\n(?![\s\S])/);
  expect(result.stdout.indexOf('\n')).toBe(result.stdout.length - 1);
  expect(result.stdout.slice(0, -1)).not.toContain('\n');

  const report = JSON.parse(result.stdout.slice(0, -1));
  expect(sortedKeys(report)).toEqual(['cases', 'failed', 'passed', 'source_sha256', 'total']);
  expect(Array.isArray(report.cases)).toBe(true);
  expect(Number.isInteger(report.total)).toBe(true);
  expect(Number.isInteger(report.passed)).toBe(true);
  expect(Number.isInteger(report.failed)).toBe(true);
  expect(report.total).toBe(10);
  expect(report.total).toBe(report.cases.length);
  expect(report.passed).toBe(report.cases.filter((item) => item.pass === true).length);
  expect(report.failed).toBe(report.cases.filter((item) => item.pass === false).length);
  expect(report.passed + report.failed).toBe(report.total);

  const names = report.cases.map((item) => {
    expect(sortedKeys(item)).toEqual(['message', 'name', 'pass']);
    expect(typeof item.name).toBe('string');
    expect(item.name.length).toBeGreaterThan(0);
    expect(typeof item.message).toBe('string');
    expect(typeof item.pass).toBe('boolean');
    return item.name;
  });
  expect(new Set(names).size).toBe(names.length);
  expect(names).toEqual([
    'whole-source preservation',
    'native list_options columns',
    'native ListService projection',
    'native _id definition',
    'native _lastUpdated definition',
    'native appointment date definition',
    'native token SQL for custom-list',
    'native token SQL for 0',
    'native token SQL for 01',
    'native token SQL for appointment-type',
  ]);

  const actualSha = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
  expect(report.source_sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(report.source_sha256).toBe(actualSha);
  expect(report.failed).toBe(0);
  expect(report.cases.every((item) => item.pass === true)).toBe(true);
  expect(result.status).toBe(0);
});
