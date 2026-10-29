'use strict';

// Source-only contract for the shared staff Questionnaire assessment. The fixture is
// the complete original PHP file, so reversing the two additions restores every byte.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '../..');
const FORM = 'interface/forms/questionnaire_assessments/questionnaire_assessments.php';
const FIXTURE = 'tests/clinical-ui/fixtures/questionnaire-assessment-original.php.txt';
const TEST = 'tests/clinical-ui/questionnaire-assessment-document-contract.cjs';
const ADAPTER = 'tests/js/questionnaire-assessment-document.test.js';
const DOC = 'docs/clinical-ui/QUESTIONNAIRE-ASSESSMENT-DOCUMENT.md';
const SCOPE = Object.freeze([FORM, TEST, FIXTURE, ADAPTER, DOC]);
const SUPPORTING = Object.freeze({
    'interface/forms/questionnaire_assessments/new.php': 'df73f08c9143725e5e21cb27cebaeceb15491f051c529960d30c8791708f2685',
    'interface/forms/questionnaire_assessments/view.php': '3a8a8a474c709fdb18b8952b5e37a509c54a71d7dd9d5adf6d00177a0c9f6cac',
    'interface/forms/questionnaire_assessments/save.php': '7041b21be3db863a6e860482de959449cecf5fbb32321453c0e95b3fce590c6d',
    'interface/forms/questionnaire_assessments/openemr_questionnaire_components.php': '812d21fd0c13da5ac9536cce5d098ace128991f7887a454df7efd14b75989d48'
});
const read = (name) => fs.readFileSync(path.join(ROOT, name));
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const original = () => read(FIXTURE).toString('utf8');

const HEAD_ANCHOR = "    <?php require __DIR__ . '/openemr_questionnaire_components.php'; ?>\n";
const BODY_ORIGINAL = '<body class="bg-light" data-theme="<?php echo attr($theme); ?>">';
const BODY_PROPOSED = '<body class="bg-light<?php echo ($isPortal ? \'\' : \' oe-qa-document\'); ?>" data-theme="<?php echo attr($theme); ?>">';
const SCOPE_SELECTOR = 'html.oe-workbench-context body.oe-qa-document';

// Frozen production proposal: paper geometry from the accepted document reference,
// with native FHIR controls and their validation styles left alone.
const RULES = Object.freeze([
    `${SCOPE_SELECTOR} {\n          color: #182c36;\n          background-color: #edf2f3 !important;\n        }`,
    `${SCOPE_SELECTOR} > .container,\n        ${SCOPE_SELECTOR} > .container-fluid {\n          width: calc(100% - 32px);\n          max-width: 1000px;\n          min-width: 0;\n          margin: 24px auto;\n          padding: 28px 36px;\n          color: #182c36;\n          background-color: #fff;\n          border: 1px solid #cbd6da;\n        }`,
    `${SCOPE_SELECTOR} > .container > .title,\n        ${SCOPE_SELECTOR} > .container-fluid > .title {\n          margin-bottom: 24px;\n          padding: 0 0 12px;\n          color: #182c36 !important;\n          background-color: #fff !important;\n          border-bottom: 1px solid #cbd6da;\n        }`,
    `${SCOPE_SELECTOR} > .container > .title h4,\n        ${SCOPE_SELECTOR} > .container-fluid > .title h4 {\n          margin-bottom: 0;\n        }`,
    `${SCOPE_SELECTOR} #qa_form {\n          min-width: 0;\n        }`,
    `${SCOPE_SELECTOR} #qa_form > .mb-3 .input-group {\n          min-width: 0;\n          flex-wrap: wrap;\n        }`,
    `${SCOPE_SELECTOR} #qa_form #form_name,\n        ${SCOPE_SELECTOR} #qa_form #category,\n        ${SCOPE_SELECTOR} #qa_form #select_item,\n        ${SCOPE_SELECTOR} #qa_form .select2-container {\n          min-width: 0;\n          max-width: 100%;\n        }`,
    `${SCOPE_SELECTOR} #qa_form > .btn-group {\n          flex-wrap: wrap;\n        }`,
    `${SCOPE_SELECTOR} #qa_form > .mb-3 input:focus-visible,\n        ${SCOPE_SELECTOR} #qa_form > .mb-3 select:focus-visible,\n        ${SCOPE_SELECTOR} #qa_form > .btn-group button:focus-visible {\n          outline: 3px solid #b65020;\n          outline-offset: 3px;\n        }`
]);
const STYLE = `    <style media="screen">\n        ${RULES.join('\n\n        ')}\n    </style>\n`;

function replaceOnce(source, before, after) {
    const at = source.indexOf(before);
    assert.ok(at >= 0, 'expected unique source anchor is absent');
    assert.equal(source.indexOf(before, at + before.length), -1, 'source anchor is repeated');
    return source.slice(0, at) + after + source.slice(at + before.length);
}

function proposedCandidate() {
    const withStyle = replaceOnce(original(), HEAD_ANCHOR, HEAD_ANCHOR + STYLE);
    return replaceOnce(withStyle, BODY_ORIGINAL, BODY_PROPOSED);
}

function restoreCandidate(candidate) {
    assert.equal(typeof candidate, 'string');
    let source = replaceOnce(candidate, HEAD_ANCHOR + STYLE, HEAD_ANCHOR);
    source = replaceOnce(source, BODY_PROPOSED, BODY_ORIGINAL);
    assert.equal(Buffer.compare(Buffer.from(source), read(FIXTURE)), 0, 'inverse differs from full original fixture');
    return source;
}

function assertCandidate(candidate) {
    assert.equal(candidate, proposedCandidate(), 'only the frozen screen presentation and portal-conditional marker are allowed');
    return restoreCandidate(candidate);
}

function assertSupportingUnchanged() {
    for (const [file, digest] of Object.entries(SUPPORTING)) {
        assert.equal(sha256(read(file)), digest, `${file} differs from the checked-out original`);
    }
}

function git(...args) {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

function assertHistory() {
    const base = '09b29da7771aea334ed5745e058751157af980d7';
    assert.equal(git('show', `${base}:${FORM}`), original(), 'fixture differs from base Git blob');
    const committedAndWorking = git('diff', '--name-only', base, '--').trim().split('\n').filter(Boolean);
    const untracked = git('ls-files', '--others', '--exclude-standard').trim().split('\n').filter(Boolean);
    for (const file of [...committedAndWorking, ...untracked]) {
        assert.ok(SCOPE.includes(file), `out-of-scope path: ${file}`);
    }
}

module.exports = { FORM, SCOPE, SUPPORTING, RULES, STYLE, BODY_ORIGINAL, BODY_PROPOSED,
    original, proposedCandidate, restoreCandidate, assertCandidate, assertSupportingUnchanged,
    assertHistory };

if (require.main === module) {
    const test = require('node:test');
    test('full proposed candidate reverses to the exact original fixture', () => {
        assert.equal(assertCandidate(proposedCandidate()), original());
    });
    if (!process.argv.includes('--candidate')) {
        test('current production is RED until the presentation is implemented', () => {
            assertCandidate(read(FORM).toString('utf8'));
        });
    }
    test('supporting wrapper, save and native component sources retain their original bytes', assertSupportingUnchanged);
    test('unique anchor, portal, action, validation, CSRF, hidden field and runtime mutations fail', () => {
        const candidate = proposedCandidate();
        const mutations = [
            candidate.replace(BODY_PROPOSED, '<body class="bg-light oe-qa-document" data-theme="<?php echo attr($theme); ?>">'),
            candidate.replace('class="btn btn-primary btn-save"', 'class="btn btn-primary btn-save d-none"'),
            candidate.replace('questionnaireRuntime.validate()', 'questionnaireRuntime.getQuestionnaireResponse()'),
            candidate.replace('name="csrf_token_form"', 'name="csrf_form"'),
            candidate.replace('name="questionnaire_response"', 'name="response"'),
            candidate.replace("questionLayout: 'vertical'", "questionLayout: 'horizontal'"),
            candidate.replace(HEAD_ANCHOR, HEAD_ANCHOR + HEAD_ANCHOR)
        ];
        for (const changed of mutations) {
            assert.notEqual(changed, candidate, 'negative must change candidate');
            assert.throws(() => assertCandidate(changed));
        }
    });
    test('each missing CSS rule, unscoped selector and print style fail', () => {
        const candidate = proposedCandidate();
        const mutations = RULES.map((rule) => candidate.replace(rule, ''));
        mutations.push(candidate.replace(SCOPE_SELECTOR, 'body'));
        mutations.push(candidate.replace('<style media="screen">', '<style media="print">'));
        for (const changed of mutations) {
            assert.notEqual(changed, candidate, 'negative must change candidate');
            assert.throws(() => assertCandidate(changed));
        }
    });
    if (process.argv.includes('--history')) {
        test('base Git blob and complete five-path mutation scope', assertHistory);
    }
}
