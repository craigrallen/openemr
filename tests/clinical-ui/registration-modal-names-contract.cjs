const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const sourcePath = path.resolve(__dirname, '../../templates/product_registration/product_registration_modal.html.twig');
const fixturePath = path.resolve(__dirname, 'fixtures/registration-modal-original.html.twig.txt');
const originalHash = '98a030b56a589d25050e187039c0d690fdb024079cac0b88e5f9a098dcaf602e';
const oldRoot = '<div class="product-registration-modal modal fade">';
const rootAddition = ` role="dialog" aria-label="{{ 'Product Registration' | xla }}"`;
const newRoot = '<div class="product-registration-modal modal fade"' + rootAddition + '>';
const oldEmail = '<input placeholder=';
const emailAddition = ` aria-label="{{ 'email' | xla }}"`;
const newEmail = '<input' + emailAddition + ' placeholder=';

function hash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function count(value, fragment) {
    return value.split(fragment).length - 1;
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function canonicalFrom(original) {
    assert(count(original, oldRoot) === 1, 'Original must contain one class-only modal root');
    assert(count(original, oldEmail) === 1, 'Original must contain one email input prefix');
    return original.replace(oldRoot, newRoot).replace(oldEmail, newEmail);
}

function inverse(candidate) {
    if (count(candidate, newRoot) !== 1 || count(candidate, newEmail) !== 1) return null;
    return candidate.replace(newRoot, oldRoot).replace(newEmail, oldEmail);
}

function validateCandidate(candidate, original) {
    const issues = [];
    if (count(candidate, '<div class="product-registration-modal modal fade"') !== 1) issues.push('modal root count');
    if (count(candidate, newRoot) !== 1) issues.push('exact root role and accessible name');
    if (count(candidate, 'role="dialog"') !== 1) issues.push('role count');
    if (count(candidate, rootAddition) !== 1) issues.push('root attributes count');
    if (count(candidate, newEmail) !== 1) issues.push('exact email attribute position');
    if (count(candidate, emailAddition) !== 1) issues.push('email attribute count');
    if (count(candidate, 'aria-label=') !== 2) issues.push('total accessible name count');
    const restored = inverse(candidate);
    if (restored === null || restored !== original || hash(restored) !== originalHash) issues.push('exact inverse and original hash');
    return issues;
}

function runContract(options = {}) {
    const cases = [];
    const add = (name, fn) => {
        try {
            fn();
            cases.push({ name, passed: true, details: 'ok' });
        } catch (error) {
            cases.push({ name, passed: false, details: error.message });
        }
    };
    let original;
    let source;
    try {
        original = fs.readFileSync(options.fixturePath || fixturePath, 'utf8');
        source = fs.readFileSync(options.sourcePath || sourcePath, 'utf8');
    } catch (error) {
        return [{ name: 'Read reserved template and fixture', passed: false, details: error.message }];
    }
    add('Original fixture has supplied SHA256', () => assert(hash(original) === originalHash, 'Fixture hash differs from supplied original'));
    if (hash(original) !== originalHash) return cases;
    let canonical;
    add('Canonical candidate derives from original fixture', () => { canonical = canonicalFrom(original); });
    if (!canonical) return cases;
    add('One exact modal root with translated accessible name', () => assert(count(source, newRoot) === 1, 'Exact modal root missing or duplicated'));
    add('One dialog role and root attribute pair', () => {
        assert(count(source, 'role="dialog"') === 1, 'Dialog role count differs');
        assert(count(source, rootAddition) === 1, 'Root attribute pair count differs');
    });
    add('One email label immediately before placeholder', () => assert(count(source, newEmail) === 1, 'Email input prefix differs'));
    add('Exactly two accessible name attributes', () => assert(count(source, 'aria-label=') === 2, 'Accessible name attribute count differs'));
    add('Names retain escaped xla translation syntax', () => {
        assert(source.includes(`{{ 'Product Registration' | xla }}`), 'Root xla expression differs');
        assert(source.includes(`{{ 'email' | xla }}`), 'Email xla expression differs');
    });
    add('Email and telemetry conditionals retain original bytes', () => {
        for (const fragment of ['{% if allowEmail %}', '{% if allowTelemetry %}']) {
            assert(count(source, fragment) === count(original, fragment), fragment + ' differs');
        }
    });
    add('Consent checked state and input IDs retain original bytes', () => {
        for (const fragment of ['id="email"', 'value=""', 'id="allowTelemetry"', 'name="allow_telemetry" checked']) {
            assert(count(source, fragment) === count(original, fragment), fragment + ' differs');
        }
    });
    add('Submit and Ask again later button classes retain original bytes', () => {
        for (const fragment of ['class="btn btn-primary submit"', 'class="btn btn-secondary nothanks"']) {
            assert(count(source, fragment) === count(original, fragment), fragment + ' differs');
        }
    });
    add('No tabindex, aria-modal, style, or visible change', () => {
        for (const fragment of ['tabindex=', 'aria-modal=', 'style=', 'visible']) {
            assert(count(source, fragment) === count(original, fragment), fragment + ' count differs');
        }
    });
    add('Exact inverse restores every original byte and SHA256', () => {
        const restored = inverse(source);
        assert(restored !== null, 'Canonical additions are missing or duplicated');
        assert(restored === original, 'Inverse differs from original bytes');
        assert(hash(restored) === originalHash, 'Inverse hash differs');
    });
    add('Complete source has only the three requested attributes', () => assert(validateCandidate(source, original).length === 0, validateCandidate(source, original).join('; ')));
    const mutations = [
        ['Wrong root role is rejected', canonical.replace('role="dialog"', 'role="presentation"')],
        ['Missing root name is rejected', canonical.replace(` aria-label="{{ 'Product Registration' | xla }}"`, '')],
        ['Raw xlt root name is rejected', canonical.replace("'Product Registration' | xla", "'Product Registration' | xlt")],
        ['Duplicate root attribute is rejected', canonical.replace(newRoot, newRoot.replace('>', rootAddition + '>'))],
        ['Removed email label is rejected', canonical.replace(newEmail, oldEmail)],
        ['Changed consent checked state is rejected', canonical.replace('name="allow_telemetry" checked', 'name="allow_telemetry"')],
        ['Changed Submit class is rejected', canonical.replace('class="btn btn-primary submit"', 'class="btn btn-primary"')],
        ['Unrelated byte change is rejected', canonical + ' ']
    ];
    for (const [name, mutated] of mutations) {
        add(name, () => {
            assert(mutated !== canonical, 'Mutation did not change canonical candidate');
            assert(validateCandidate(mutated, original).length > 0, 'Mutation was accepted');
        });
    }
    return cases;
}

module.exports = { runContract };

if (require.main === module) {
    const cases = runContract();
    const passed = cases.filter(item => item.passed).length;
    const failed = cases.length - passed;
    process.stdout.write(JSON.stringify({ cases, passed, failed }) + '\n');
    if (failed) process.exitCode = 1;
}
