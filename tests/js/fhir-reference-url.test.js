const path = require('node:path');
const { spawnSync } = require('node:child_process');

const expectedNames = [
    'source_inverse_sha256',
    'base_no_slash_patient_suffix',
    'base_no_slash_patient_reference',
    'base_with_slash_patient_suffix',
    'base_with_slash_patient_reference',
    'nested_base_path',
    'http_base',
    'https_base',
    'encounter_reference',
    'opaque_zero_id',
    'case_sensitive_resource',
    'same_host_wrong_path',
    'sibling_fhir_extra',
    'foreign_base_in_path',
    'foreign_base_in_query',
    'foreign_base_in_fragment',
    'bare_base_no_slash',
    'base_with_slash_empty_suffix',
    'different_scheme',
    'different_port',
    'unrelated_remote',
    'null_url',
    'false_url',
    'original_bytes',
].sort();

function sortedKeys(value) {
    return Object.keys(value).sort();
}

describe('FHIR reference URL contract', () => {
    test('native PHP resolver and reference parser satisfy the fixed cases', () => {
        const fixture = path.resolve(__dirname, '..', 'clinical-ui', 'fhir-reference-url-contract.php.fixture');
        const result = spawnSync('php', [fixture], {
            encoding: 'utf8',
            timeout: 15000,
            maxBuffer: 1024 * 1024,
        });

        expect(result.error).toBeUndefined();
        expect(result.signal).toBeNull();
        expect(result.status).toBe(0);
        expect(result.stderr).toBe('');
        const frame = /^([^\r\n]+)\n(?![\s\S])/.exec(result.stdout);
        expect(frame).not.toBeNull();
        const report = JSON.parse(frame[1]);
        expect(sortedKeys(report)).toEqual(['cases', 'failed', 'passed']);
        expect(Array.isArray(report.cases)).toBe(true);
        expect(report.cases.length).toBe(expectedNames.length);
        const names = report.cases.map((entry) => {
            expect(entry).not.toBeNull();
            expect(Array.isArray(entry)).toBe(false);
            expect(typeof entry).toBe('object');
            expect(sortedKeys(entry)).toEqual(['name', 'ok']);
            expect(typeof entry.name).toBe('string');
            expect(entry.ok).toBe(true);
            return entry.name;
        });
        expect(new Set(names).size).toBe(expectedNames.length);
        expect(names).toEqual(expectedNames);
        expect(report.passed).toBe(report.cases.length);
        expect(report.failed).toBe(0);
    });
});
