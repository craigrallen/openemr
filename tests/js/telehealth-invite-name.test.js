const path = require('node:path');
const { spawnSync } = require('node:child_process');

const expectedCases = [
    'original_fixture_sha256',
    'one_approved_root_opening_tag',
    'visible_translated_title',
    'root_attribute_uses_xla',
    'inverse_preserves_original_bytes',
    'root_modal_semantics',
    'native_template_include',
    'native_clone_and_id_reassignment',
    'native_bootstrap_container',
    'native_dialog_invocation',
    'rejects_duplicate_root_label',
    'rejects_label_on_child_instead_of_root',
    'rejects_wrong_root_attribute',
    'rejects_wrong_attribute_escaping',
    'rejects_hidden_behavioral_drift',
    'rejects_original_fixture_tamper',
];

test('telehealth invite name source contract reports all 16 cases passed', () => {
    const contract = path.resolve(__dirname, '../clinical-ui/telehealth-invite-name-contract.cjs');
    const run = spawnSync(process.execPath, [contract], { encoding: 'utf8' });

    expect(run.error).toBeUndefined();
    expect(run.signal).toBeNull();
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/^\{[^\n]*\}\n$/);

    const result = JSON.parse(run.stdout);
    expect(Object.keys(result).sort()).toEqual(['cases', 'exitStatus', 'failed', 'passed']);
    expect(result.cases).toHaveLength(expectedCases.length);
    expect(result.cases.map(({ name }) => name)).toEqual(expectedCases);
    expect(new Set(result.cases.map(({ name }) => name)).size).toBe(expectedCases.length);
    for (const item of result.cases) {
        expect(Object.keys(item).sort()).toEqual(['name', 'passed']);
        expect(item.passed).toBe(true);
    }
    expect(result.passed).toBe(expectedCases.length);
    expect(result.failed).toBe(0);
    expect(result.exitStatus).toBe(0);
});
