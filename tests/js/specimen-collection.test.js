/* global __dirname */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const fixture = path.join(root, 'tests/clinical-ui/specimen-collection-contract.php.fixture');
const source = path.join(root, 'src/Services/FHIR/FhirSpecimenService.php');
const descriptions = ['absent', 'null', 'empty'];
const exactNames = [
    'native_source_provenance',
    ...descriptions.flatMap((suffix) => [
        `method_code_${suffix}`,
        `location_code_${suffix}`,
        `both_codes_${suffix}`,
    ]),
    'both_codes_descriptions',
    'descriptions_only',
    'dates_only',
    'codes_with_collected_date',
    'codes_with_period',
    'empty_collection',
];

test('native specimen collection contract passes all exact cases', () => {
    const result = spawnSync('php', [fixture], {
        cwd: root,
        encoding: 'utf8',
        timeout: 15000,
        maxBuffer: 1024 * 1024,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
    const lines = result.stdout.trim().split(/\r?\n/);
    expect(lines).toHaveLength(1);
    const report = JSON.parse(lines[0]);
    expect(report.total).toBe(exactNames.length);
    expect(report.cases).toHaveLength(exactNames.length);
    expect(report.cases.map(({ name }) => name)).toEqual(exactNames);
    expect(report.source_sha256).toBe(crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'));
    expect(report.errors).toEqual([]);
    expect(report.failed).toBe(0);
    expect(report.cases.every(({ passed }) => passed === true)).toBe(true);
    expect(result.status).toBe(0);
}, 20000);
