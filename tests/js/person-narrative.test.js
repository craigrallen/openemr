/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const source = path.join(root, 'src/Services/FHIR/FhirPersonService.php');
const fixture = path.join(root, 'tests/clinical-ui/person-narrative-contract.php.fixture');
const originalSha = '327c26ab2140b27b60a4e960a0d9efe06b2b7cfc0e200606090f6420ba61b316';
const originalOperand = `'div' => '<div xmlns="http://www.w3.org/1999/xhtml"> <p>' . $narrativeText . '</p></div>'`;
const fixedOperand = `'div' => '<div xmlns="http://www.w3.org/1999/xhtml"> <p>' . htmlspecialchars($narrativeText, ENT_QUOTES | ENT_SUBSTITUTE | ENT_XML1, 'UTF-8') . '</p></div>'`;
const originalFnameAssignment = "$narrativeText = $dataRecord['fname'];";
const fixedFnameAssignment = "$narrativeText .= $dataRecord['fname'];";
const expectedNames = [
    'source_integrity', 'native_class_paths', 'special_characters_object',
    'special_characters_encoded', 'literal_entities', 'multilingual_names',
    'zero_name', 'absent_names', 'null_names', 'empty_names',
    'whitespace_names', 'last_name_only', 'full_mapping_unchanged',
    'input_immutable_independent_outputs', 'invalid_utf8_object',
    'invalid_utf8_native_json_limit',
];
const keys = value => Object.keys(value).sort();
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

test('native Person narrative contract reports every case and preserves source integrity', () => {
    const run = spawnSync('php', [fixture], {
        cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
    });
    expect(run.error).toBeUndefined();
    expect(run.signal).toBeNull();
    expect(run.stderr).toBe('');
    expect([0, 1]).toContain(run.status);
    let report;
    expect(() => { report = JSON.parse(run.stdout); }).not.toThrow();
    expect(keys(report)).toEqual(['cases', 'failed', 'passed', 'source_sha256', 'total'].sort());
    expect(Array.isArray(report.cases)).toBe(true);
    expect(report.total).toBe(expectedNames.length);
    expect(report.cases).toHaveLength(expectedNames.length);
    expect(report.cases.map(item => item.name).sort()).toEqual([...expectedNames].sort());
    report.cases.forEach(item => {
        expect(keys(item)).toEqual(['error', 'name', 'ok'].sort());
        expect(typeof item.name).toBe('string');
        expect(typeof item.ok).toBe('boolean');
        expect(item.ok ? item.error === null : typeof item.error === 'string' && item.error.length > 0).toBe(true);
    });
    const passed = report.cases.filter(item => item.ok).length;
    expect(report.passed).toBe(passed);
    expect(report.failed).toBe(report.total - passed);
    expect(run.status).toBe(report.failed === 0 ? 0 : 1);

    const actualSource = fs.readFileSync(source);
    expect(report.source_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.source_sha256).toBe(sha256(actualSource));
    const text = actualSource.toString('utf8');
    if (report.source_sha256 === originalSha) {
        expect(text.split(originalOperand)).toHaveLength(2);
        expect(text.split(originalFnameAssignment)).toHaveLength(2);
    } else {
        expect(text.split(fixedOperand)).toHaveLength(2);
        expect(text.split(fixedFnameAssignment)).toHaveLength(2);
        const inverse = text.replace(fixedOperand, originalOperand)
            .replace(fixedFnameAssignment, originalFnameAssignment);
        expect(sha256(Buffer.from(inverse))).toBe(originalSha);
    }

    expect(report.failed).toBe(0);
    expect(report.cases.every(item => item.ok)).toBe(true);
});
