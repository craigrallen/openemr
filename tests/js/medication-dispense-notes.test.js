const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '../..');
const source = path.join(root, 'src/Services/FHIR/MedicationDispense/FhirMedicationDispenseLocalDispensaryService.php');
const fixture = path.join(root, 'tests/clinical-ui/medication-dispense-notes-contract.php.fixture');
const expectedNames = [
    'source_exact_inverse',
    'projected_notes_object',
    'projected_notes_encoded_json',
    'singular_note_distractor',
    'unicode_markup_newline_whitespace',
    'empty_guard_missing',
    'empty_guard_null',
    'empty_guard_empty',
    'empty_guard_string_zero',
    'empty_guard_integer_zero',
    'empty_guard_false',
    'resource_fields_baseline',
    'resource_fields_preserved',
    'input_immutable',
    'repeated_parsing_independent',
];

test('native MedicationDispense notes contract', () => {
    const result = spawnSync('php', [fixture], {
        cwd: root,
        encoding: 'utf8',
        timeout: 30000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
    let report;
    expect(() => { report = JSON.parse(result.stdout); }).not.toThrow();
    expect(report).toStrictEqual(expect.objectContaining({
        cases: expect.any(Array),
        total: expectedNames.length,
        passed: expectedNames.length,
        failed: 0,
        source_sha256: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),
    }));
    expect(Object.keys(report).sort()).toEqual(['cases', 'failed', 'passed', 'source_sha256', 'total']);
    expect(report.cases.map((item) => item.name)).toEqual(expectedNames);
    for (const item of report.cases) {
        expect(Object.keys(item).sort()).toEqual(['error', 'name', 'ok']);
        expect(item.ok).toBe(true);
        expect(item.error).toBeNull();
    }
    expect(result.status).toBe(0);
});
