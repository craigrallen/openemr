const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const fixture = path.join(root, 'tests/clinical-ui/procedure-code-display-contract.php.fixture');
const source = path.join(root, 'src/Services/FHIR/Procedure/FhirProcedureOEProcedureService.php');
const names = [
  'source byte inverse',
  'native declarations and parser',
  'typed CPT4 primary display',
  'typed SNOMED primary display',
  'reason and LOINC lookup independence',
  'missing descriptions and code fallback',
  'status date and identity preservation',
];

test('native FHIR Procedure code display contract', () => {
  const result = spawnSync('php', [fixture], { cwd: root, encoding: 'utf8', timeout: 30000 });
  if (result.error) throw result.error;
  expect(result.signal).toBeNull();
  expect(result.stderr).toBe('');
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Procedure fixture did not emit valid JSON (exit ${result.status}): ${error.message}; stdout: ${result.stdout}; stderr: ${result.stderr}`);
  }
  expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed', 'source_sha256', 'total']);
  expect(report.total).toBe(names.length);
  expect(report.passed).toBe(names.length);
  expect(report.failed).toBe(0);
  expect(report.cases).toHaveLength(names.length);
  expect(report.cases.map(({ name }) => name)).toEqual(names);
  expect(new Set(report.cases.map(({ name }) => name)).size).toBe(names.length);
  for (const item of report.cases) {
    expect(Object.keys(item).sort()).toEqual(['error', 'name', 'ok']);
    expect(item.ok).toBe(true);
    expect(item.error).toBeNull();
  }
  expect(report.source_sha256).toBe(createHash('sha256').update(readFileSync(source)).digest('hex'));
  expect(result.status).toBe(0);
});
