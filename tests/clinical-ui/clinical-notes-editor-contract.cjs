'use strict';

// node --test-reporter=tap tests/clinical-ui/clinical-notes-editor-contract.cjs [--history]
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const sourcePath = 'interface/forms/clinical_notes/templates/new.html.twig';
const fixturePath = 'tests/clinical-ui/fixtures/clinical-notes-template-original.twig.txt';
const ORIGINAL_SHA256 = '0974797eaa6dfb5bd64335f2b3ab57311b1758630d0b29a4adcf293639860f3f';
const HEAD = '    </script>\n{% endblock %}';
const FORM = "<form method='post' name='my_form'";

// Export this entire block for the controller's stylelint gate before production insertion.
const CSS = `<style>
@media screen {
  html.oe-workbench-context body form.oe-clinical-notes-editor {
    box-sizing: border-box;
    width: calc(100% - 2rem);
    max-width: 860px;
    margin: 1.5rem auto 2rem;
    padding: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-radius: 7px;
    background-color: #fff;
    color: #182c36;
    box-shadow: 0 8px 28px rgb(24 44 54 / 8%);
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor > legend {
    width: 100%;
    margin: 0 0 1.25rem;
    padding: 0 0 0.75rem;
    border-bottom: 1px solid #cbd6da;
    background-color: #fff;
    color: #182c36;
    font-size: 1.35rem;
    font-weight: 700;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor > .container-fluid {
    padding: 0;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row {
    min-width: 0;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
    margin: 0;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row > .forms.col-lg-4,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row > .forms.col-lg-8 {
    flex: 0 0 100%;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    padding: 0;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row > .forms > .row {
    margin: 0;
    padding: 0 !important;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row > .col-lg-4 > .row {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    gap: 0.75rem 0;
    margin-bottom: 1.25rem;
    padding-bottom: 1rem !important;
    border-bottom: 1px solid #dbe4e7;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .hide-author {
    box-sizing: border-box;
    display: flex;
    flex: 0 0 100%;
    flex-wrap: wrap;
    max-width: 100%;
    min-width: 0;
    gap: 0.35rem 1.5rem;
    padding: 0 15px;
    color: #536773;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .hide-author > .col-12 {
    flex: 0 1 auto;
    width: auto;
    max-width: 100%;
    min-width: 0;
    padding: 0;
    overflow-wrap: anywhere;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .hide-author .text-muted {
    color: #536773 !important;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row > .col-lg-4 > .row > .col-12 {
    flex: 0 0 33.333%;
    max-width: 33.333%;
    min-width: 0;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row > .col-lg-8 > .row > .col-12 {
    padding-right: 0;
    padding-left: 0;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row label {
    margin-bottom: 0.35rem;
    color: #182c36;
    font-size: 0.875rem;
    font-weight: 650;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .col-lg-4 hr {
    display: none;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row > .col-lg-4 .form-control {
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row textarea.description {
    box-sizing: border-box;
    width: 100%;
    min-height: 12rem;
    padding: 0.9rem 1rem;
    border: 1px solid #8fa5af;
    border-radius: 5px;
    background-color: #fff;
    color: #182c36;
    line-height: 1.7;
    resize: vertical;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .linked-documents-container,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .linked-results-container {
    background-color: #f3f7f8 !important;
    border-color: #cbd6da !important;
    color: #182c36;
    line-height: 1.5;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .linked-documents-container .text-muted,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .linked-results-container .text-muted {
    color: #536773 !important;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .document-item.badge,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .result-item.badge {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    min-width: 0;
    padding: 0.4rem 0.55rem;
    background-color: #dbe9ec;
    color: #183b49;
    font-size: 0.8rem;
    line-height: 1.4;
    white-space: normal;
    text-align: left;
    overflow-wrap: anywhere;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-close-document,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-close-result {
    flex: 0 0 auto;
    min-width: 1.5rem;
    min-height: 1.5rem;
    border: 1px solid #426b78;
    border-radius: 3px;
    background-color: #fff;
    color: #183b49;
    font-size: 1rem;
    line-height: 1;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-close-document:hover,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-close-result:hover {
    border-color: #913c36;
    background-color: #fff0ed;
    color: #762e29;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .btn-save,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-add,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-add-documents,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-add-results {
    border-color: #145968;
    background-color: #145968;
    color: #fff;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .btn-save:hover,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-add:hover,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-add-documents:hover,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-add-results:hover {
    border-color: #0d4350;
    background-color: #0d4350;
    color: #fff;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .btn-cancel {
    border-color: #9baeb8;
    background-color: #e4ecef !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .btn-cancel:hover {
    border-color: #7894a0;
    background-color: #d2e0e5 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .btn-cancel:active {
    border-color: #7894a0;
    background-color: #d2e0e5 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-delete {
    border-color: #913c36;
    background-color: #913c36;
    color: #fff;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-delete:hover {
    border-color: #762e29;
    background-color: #762e29;
    color: #fff;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .btn-save:focus,
  html.oe-workbench-context body form.oe-clinical-notes-editor .btn-save:focus-visible,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-add:focus,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-add-documents:focus,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-add-results:focus {
    border-color: #145968;
    background-color: #145968;
    color: #fff;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .btn-cancel:focus,
  html.oe-workbench-context body form.oe-clinical-notes-editor .btn-cancel:focus-visible {
    border-color: #7894a0;
    background-color: #e4ecef !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-delete:focus,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-close-document:focus,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row .btn-close-result:focus {
    border-color: #913c36;
    background-color: #913c36;
    color: #fff;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor > .container-fluid > .form-group button:disabled,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row button:disabled {
    border-color: #aebdc3 !important;
    background-color: #e4e9eb !important;
    color: #536773 !important;
    cursor: not-allowed;
    opacity: 1;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor .btn-save:focus,
  html.oe-workbench-context body form.oe-clinical-notes-editor .btn-save:focus-visible,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row button:focus,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row button:focus-visible,
  html.oe-workbench-context body form.oe-clinical-notes-editor .btn-cancel:focus,
  html.oe-workbench-context body form.oe-clinical-notes-editor .btn-cancel:focus-visible,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row input:focus,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row input:focus-visible,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row select:focus,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row select:focus-visible,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row textarea:focus,
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row textarea:focus-visible {
    outline: 3px solid #a84c22;
    outline-offset: 2px;
  }

  html.oe-workbench-context body form.oe-clinical-notes-editor > .container-fluid > .form-group .btn-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1.25rem;
  }
}

@media screen and (width <= 640px) {
  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row > .col-lg-4 > .row > .col-12 {
    flex-basis: 100%;
    max-width: 100%;
  }
}
</style>`;

const additions = [
    [HEAD, `    </script>\n${CSS}\n{% endblock %}`],
    [FORM, "<form class='oe-clinical-notes-editor' method='post' name='my_form'"]
];
const read = (relative) => fs.readFileSync(path.join(root, relative));
const git = (...args) => execFileSync('git', args, { cwd: root });
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function once(bytes, needle, label) {
    const first = bytes.indexOf(needle);
    assert.notEqual(first, -1, `${label}: present`);
    assert.equal(first, bytes.lastIndexOf(needle), `${label}: unique`);
}

function replaceOnce(bytes, before, after, label) {
    const source = Buffer.from(bytes);
    const old = Buffer.from(before);
    once(source, old, label);
    const at = source.indexOf(old);
    return Buffer.concat([source.subarray(0, at), Buffer.from(after), source.subarray(at + old.length)]);
}

function original() {
    const bytes = read(fixturePath);
    assert.equal(hash(bytes), ORIGINAL_SHA256, 'frozen original SHA256');
    return bytes;
}

function proposed(bytes) {
    let result = Buffer.from(bytes);
    for (const [before, after] of additions) result = replaceOnce(result, before, after, 'original insertion seam');
    return result;
}

function verifySource(source, baseline = original()) {
    let inverse = Buffer.from(source);
    for (const [before, after] of additions) inverse = replaceOnce(inverse, after, before, 'exact proposed addition');
    assert.deepEqual(inverse, baseline, 'source must invert byte for byte to frozen original');
}

function assertNarrativeFullWidth(css) {
    const selector = 'html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row > .col-lg-8 > .row > .col-12';
    once(Buffer.from(css), Buffer.from(`${selector} {`), 'narrative column selector');
    const opening = css.indexOf('{', css.indexOf(selector));
    const rule = css.slice(opening + 1, css.indexOf('}', opening));
    assert.match(rule, /(?:^|\n)\s*padding-right: 0;/, 'narrative column removes right gutter');
    assert.match(rule, /(?:^|\n)\s*padding-left: 0;/, 'narrative column removes left gutter');
    assert.doesNotMatch(css, /> \.col-lg-4 > \.row > \.col-12 \{[^}]*padding-(?:right|left): 0;/, 'metadata gutters remain');
}

function cssRules(css) {
    return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
        selectors: match[1].split(',').map((member) => member.trim()),
        body: match[2],
        index: match.index
    }));
}

function assertScopedSelectors(css) {
    const prefix = 'html.oe-workbench-context body form.oe-clinical-notes-editor';
    for (const rule of cssRules(css)) {
        for (const member of rule.selectors) {
            assert.ok(member.startsWith(`${prefix} `) || member === prefix, `scoped selector: ${member}`);
        }
    }
}

function assertCascadeGuards(css) {
    const rules = cssRules(css);
    const prefix = 'html.oe-workbench-context body form.oe-clinical-notes-editor';
    const ruleFor = (selector, property) => {
        const matches = rules.filter((rule) => rule.selectors.includes(`${prefix} ${selector}`) &&
            (!property || rule.body.split('\n').some((line) => line.trim().startsWith(`${property}:`))));
        assert.equal(matches.length, 1, `unique cascade rule: ${selector}`);
        return matches[0];
    };
    const important = (rule, property, value) => {
        assert.ok(rule.body.split('\n').some((line) => line.trim() === `${property}: ${value} !important;`),
            `${rule.selectors.join(', ')}: ${property} must win theme cascade`);
    };
    const fieldset = ruleFor('.tb_row > fieldset');
    important(fieldset, 'background-color', '#fff');
    important(fieldset, 'color', '#182c36');
    const metadata = ruleFor('.tb_row > fieldset > .form-row > .col-lg-4 .form-control');
    important(metadata, 'background-color', '#fff');
    important(metadata, 'color', '#182c36');
    for (const [selector, background] of [
        ['.btn-cancel', '#e4ecef'],
        ['.btn-cancel:hover', '#d2e0e5'],
        ['.btn-cancel:active', '#d2e0e5'],
        ['.btn-cancel:focus', '#e4ecef'],
        ['.btn-cancel:focus-visible', '#e4ecef']
    ]) {
        const cancel = ruleFor(selector, 'background-color');
        important(cancel, 'background-color', background);
        important(cancel, 'color', '#182c36');
    }
    for (const container of ['.linked-documents-container', '.linked-results-container']) {
        important(ruleFor(`.tb_row > fieldset > .form-row ${container} .text-muted`), 'color', '#536773');
    }
    const lastFocusPalette = Math.max(...rules.filter((rule) => rule.selectors.some((selector) =>
        selector.includes(':focus') && rule.body.includes('background-color:'))).map((rule) => rule.index));
    for (const selector of [
        '> .container-fluid > .form-group button:disabled',
        '.tb_row > fieldset > .form-row button:disabled'
    ]) {
        const disabled = ruleFor(selector);
        assert.ok(disabled.index > lastFocusPalette, `${selector}: disabled palette follows focus palettes`);
        important(disabled, 'border-color', '#aebdc3');
        important(disabled, 'background-color', '#e4e9eb');
        important(disabled, 'color', '#536773');
    }
}

const unchanged = [
    'interface/forms/clinical_notes/templates/partials/new/_clinical-notes-row.html.twig',
    'interface/forms/clinical_notes/templates/partials/new/_clinical-notes-row-actions.html.twig',
    'interface/forms/clinical_notes/templates/partials/new/_clinical-notes-form-actions.html.twig',
    'interface/forms/clinical_notes/new.php',
    'interface/forms/clinical_notes/save.php',
    'interface/forms/clinical_notes/view.php',
    'templates/core/base.html.twig',
    'docs/clinical-ui/PLAN.md'
];
const allowed = new Set([
    sourcePath,
    fixturePath,
    'tests/clinical-ui/clinical-notes-editor-contract.cjs',
    'tests/js/clinical-notes-editor.test.js',
    'docs/clinical-ui/CLINICAL-NOTES-EDITOR.md'
]);
function checkScope(files) {
    for (const file of files) assert.ok(allowed.has(file), `out-of-scope changed path: ${file}`);
}

assert.deepEqual(process.argv.slice(2).filter((arg) => arg !== '--history'), [], 'unknown option');
const history = process.argv.includes('--history');

test('frozen template retains form, CSRF, loop, includes and native actions', () => {
    const source = original().toString();
    for (const item of [
        "{% extends \"core/base.html.twig\" %}",
        "{{ setupHeader(['i18next', 'i18formatting', 'datetime-picker','datetime-picker-translated']) }}",
        'window.oeFormsClinicalNotes.init({',
        "<form method='post' name='my_form' action='{{ rootdir }}/forms/clinical_notes/save.php?id={{ formid|attr_url }}'>",
        "{{ csrfToken('default', 'csrf_token_form') }}",
        '{% for key,obj in check_res %}',
        '{% set index = key+1 %}',
        'clinical_notes/templates/partials/new/_clinical-notes-row.html.twig',
        'clinical_notes/templates/partials/new/_clinical-notes-form-actions.html.twig'
    ]) assert.ok(source.includes(item), `native template: ${item}`);
    const row = read(unchanged[0]).toString();
    for (const item of [
        'name="description[]"', '{{ obj.description|text }}', 'class="forms col-lg-4"',
        'class="forms col-lg-8"', 'class="hide-author"', 'class="linked-documents-container',
        'class="linked-results-container', 'class="btn-close-document', 'class="btn-close-result',
        'document-search-template', 'results-search-template', '_clinical-notes-row-actions.html.twig'
    ]) assert.ok(row.includes(item), `native row: ${item}`);
    assert.match(read(unchanged[1]).toString(), /btn-add[\s\S]*btn-delete/);
    assert.match(read(unchanged[2]).toString(), /btn-save[\s\S]*btn-cancel/);
});

test('CSS supplies workbench paper, full narrative, metadata and narrowly scoped controls', () => {
    assert.match(CSS, /^<style>\n@media screen \{/);
    assert.match(CSS, /max-width: 860px;/);
    assert.match(CSS, /padding: clamp\(1rem, 4vw, 2\.25rem\);/);
    assert.match(CSS, /\.forms\.col-lg-4,[\s\S]*?\.forms\.col-lg-8 \{[\s\S]*?flex: 0 0 100%;/);
    assert.match(CSS, /\.col-lg-4 > \.row > \.col-12 \{[\s\S]*?flex: 0 0 33\.333%;/);
    assertNarrativeFullWidth(CSS);
    assert.match(CSS, /\.hide-author \{[\s\S]*?display: flex;/);
    assert.match(CSS, /\.hide-author > \.col-12 \{[^}]*max-width: 100%;[^}]*min-width: 0;[^}]*overflow-wrap: anywhere;/);
    assert.match(CSS, /textarea\.description \{[\s\S]*?width: 100%;[\s\S]*?min-height: 12rem;[\s\S]*?line-height: 1\.7;[\s\S]*?resize: vertical;/);
    for (const item of ['.linked-documents-container', '.linked-results-container', '.document-item.badge', '.result-item.badge', '.btn-close-document', '.btn-close-result', '.btn-add-documents', '.btn-add-results', '.btn-add', '.btn-delete', '.btn-save', '.btn-cancel']) assert.ok(CSS.includes(item), `visible control: ${item}`);
    assert.match(CSS, /\.result-item\.badge \{[^}]*overflow-wrap: anywhere;/);
    assert.match(CSS, /\.btn-close-result \{[^}]*flex: 0 0 auto;/);
    assert.match(CSS, /@media screen and \(width <= 640px\)/);
    assert.doesNotMatch(CSS, /@media print|<script|display: none;[^}]*button/);
    assert.doesNotMatch(CSS, /document-search-dialog|results-search-dialog|document-item-template|result-item-template/);
    assertScopedSelectors(CSS);
});

test('paired action palettes include hover, focus and disabled states', () => {
    for (const [selector, ink, background] of [
        ['.btn-save', '#fff', '#145968'],
        ['.btn-cancel', '#182c36', '#e4ecef'],
        ['.btn-delete', '#fff', '#913c36'],
        ['.btn-close-document', '#183b49', '#fff']
    ]) {
        const at = CSS.indexOf(selector);
        assert.ok(at >= 0, `palette selector ${selector}`);
        const opening = CSS.indexOf('{', at);
        const rule = CSS.slice(opening, CSS.indexOf('}', opening));
        assert.ok(rule.includes(`background-color: ${background}${selector === '.btn-cancel' ? ' !important' : ''};`), `${selector} background`);
        assert.ok(rule.includes(`color: ${ink}${selector === '.btn-cancel' ? ' !important' : ''};`), `${selector} ink`);
        assert.ok(CSS.includes(`${selector}:hover`), `${selector} hover`);
    }
    assert.match(CSS, /button:focus-visible[\s\S]*?outline: 3px solid #a84c22;/);
    assertCascadeGuards(CSS);
});

test('synthetic proposal passes the byte-exact inverse', () => {
    const baseline = original();
    verifySource(proposed(baseline), baseline);
});

test('specific semantic, geometry, palette and scope mutants are rejected', () => {
    const baseline = original();
    const candidate = proposed(baseline);
    for (const [before, after] of [
        ["{{ csrfToken('default', 'csrf_token_form') }}", "{{ csrfToken('other', 'csrf_token_form') }}"],
        ['{% for key,obj in check_res %}', '{% for obj in check_res %}'],
        ['clinical_notes/templates/partials/new/_clinical-notes-row.html.twig', 'clinical_notes/templates/partials/new/_other.html.twig'],
        ['max-width: 860px;', 'max-width: 1200px;'],
        ['min-height: 12rem;', 'min-height: 2rem;'],
        ['line-height: 1.7;', 'line-height: 1;'],
        ['resize: vertical;', 'resize: none;'],
        ['background-color: #0d4350;', 'background-color: #fff;'],
        ['  html.oe-workbench-context body form.oe-clinical-notes-editor {', '  html body form.oe-clinical-notes-editor {'],
        ["class='oe-clinical-notes-editor' method='post'", "method='post'"],
        ['@media screen {', '@media print {'],
        ['outline: 3px solid #a84c22;', 'outline: 0;'],
        ['</style>', '@media print { body { display: none; } }\n</style>']
    ]) {
        const changed = replaceOnce(candidate, before, after, 'negative mutant');
        assert.throws(() => verifySource(changed, baseline), `reject mutant: ${before}`);
    }
    for (const gutter of ['padding-right: 0;', 'padding-left: 0;']) {
        const selector = 'html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row > .col-lg-8 > .row > .col-12';
        const opening = CSS.indexOf('{', CSS.indexOf(selector));
        const closing = CSS.indexOf('}', opening);
        const mutant = CSS.slice(0, opening) + CSS.slice(opening, closing).replace(gutter, '') + CSS.slice(closing);
        assert.throws(() => assertNarrativeFullWidth(mutant), `reject missing narrative ${gutter}`);
    }
    const cascadeMutants = [
        ['.tb_row > fieldset {', 'background-color: #fff !important;', 'background-color: #fff;'],
        ['.tb_row > fieldset {', 'color: #182c36 !important;', 'color: #182c36;'],
        ['.form-row > .col-lg-4 .form-control {', 'background-color: #fff !important;', 'background-color: #fff;'],
        ['.form-row > .col-lg-4 .form-control {', 'color: #182c36 !important;', 'color: #182c36;'],
        ['.btn-cancel {', 'background-color: #e4ecef !important;', 'background-color: #e4ecef;'],
        ['.btn-cancel {', 'color: #182c36 !important;', 'color: #182c36;'],
        ['.btn-cancel:hover {', 'background-color: #d2e0e5 !important;', 'background-color: #d2e0e5;'],
        ['.btn-cancel:hover {', 'color: #182c36 !important;', 'color: #182c36;'],
        ['.btn-cancel:active {', 'background-color: #d2e0e5 !important;', 'background-color: #d2e0e5;'],
        ['.btn-cancel:active {', 'color: #182c36 !important;', 'color: #182c36;'],
        ['.btn-cancel:focus-visible {', 'background-color: #e4ecef !important;', 'background-color: #e4ecef;'],
        ['.btn-cancel:focus-visible {', 'color: #182c36 !important;', 'color: #182c36;'],
        ['.linked-documents-container .text-muted,', 'color: #536773 !important;', 'color: #536773;'],
        ['.linked-results-container .text-muted {', 'color: #536773 !important;', 'color: #536773;'],
        ['.form-row button:disabled {', 'background-color: #e4e9eb !important;', 'background-color: #e4e9eb;'],
        ['.form-row button:disabled {', 'color: #536773 !important;', 'color: #536773;']
    ];
    for (const [anchor, before, after] of cascadeMutants) {
        const at = CSS.indexOf(anchor);
        assert.ok(at >= 0, `cascade mutant anchor: ${anchor}`);
        const opening = CSS.indexOf('{', at);
        const closing = CSS.indexOf('}', opening);
        const mutant = CSS.slice(0, opening) + CSS.slice(opening, closing).replace(before, after) + CSS.slice(closing);
        assert.notEqual(mutant, CSS, `cascade mutant changed rule: ${anchor}`);
        assert.throws(() => assertCascadeGuards(mutant), `reject cascade mutant: ${anchor}`);
    }
    for (const [before, after] of [
        ['.tb_row > fieldset > .form-row > .col-lg-4 .form-control {', '.tb_row > fieldset > .form-row .form-control {'],
        ['.btn-cancel:active {', '.btn-cancel:visited {']
    ]) {
        const mutant = replaceOnce(CSS, before, after, 'palette selector mutant').toString();
        assert.throws(() => assertCascadeGuards(mutant), `reject palette selector mutant: ${before}`);
    }
    for (const container of ['.linked-documents-container', '.linked-results-container']) {
        const selector = `.tb_row > fieldset > .form-row ${container} .text-muted`;
        const mutant = replaceOnce(CSS, selector, `.tb_row > fieldset > .form-row ${container}`, 'empty-link selector mutant').toString();
        assert.throws(() => assertCascadeGuards(mutant), `reject missing ${container} text-muted selector`);
    }
    const firstMember = '  html.oe-workbench-context body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row > .forms.col-lg-4,';
    const unscoped = replaceOnce(CSS, firstMember, '  body form.oe-clinical-notes-editor .tb_row > fieldset > .form-row > .forms.col-lg-4,', 'first selector member').toString();
    assert.throws(() => assertScopedSelectors(unscoped), 'reject unscoped first selector-list member');
    assert.throws(() => verifySource(baseline, baseline), 'unedited source remains red');
});

test('five-path boundary rejects unrelated files', () => {
    assert.throws(() => checkScope([sourcePath, 'interface/forms/clinical_notes/save.php']), /out-of-scope/);
    checkScope([...allowed]);
});

test('actual template contains exactly the proposed additions', () => {
    const baseline = original();
    const current = read(sourcePath);
    assert.notDeepEqual(current, baseline, 'presentation addition is missing');
    verifySource(current, baseline);
});

if (history) test('committed history, frozen blob, supporting files and working tree obey five-path scope', () => {
    git('merge-base', '--is-ancestor', BASE, 'HEAD');
    assert.deepEqual(original(), git('show', `${BASE}:${sourcePath}`), 'fixture equals exact base blob');
    for (const file of unchanged) {
        assert.deepEqual(read(file), git('show', `${BASE}:${file}`), `${file} working bytes unchanged`);
        assert.deepEqual(git('show', `HEAD:${file}`), git('show', `${BASE}:${file}`), `${file} committed bytes unchanged`);
    }
    const split = (bytes) => bytes.toString().split('\0').filter(Boolean);
    const changed = [
        ...split(git('diff', '--name-only', '-z', '--no-renames', BASE, 'HEAD', '--')),
        ...split(git('diff', '--name-only', '-z', '--no-renames', 'HEAD', '--')),
        ...split(git('diff', '--cached', '--name-only', '-z', '--no-renames', '--')),
        ...split(git('ls-files', '--others', '--exclude-standard', '-z'))
    ];
    checkScope(changed);
    for (const file of changed) {
        const absolute = path.join(root, file);
        if (fs.existsSync(absolute)) assert.ok(!fs.lstatSync(absolute).isSymbolicLink(), `symlink: ${file}`);
    }
});

module.exports = { CSS, original, proposed, verifySource, sourcePath };
