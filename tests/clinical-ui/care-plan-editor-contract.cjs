'use strict';

// node --test-reporter=tap tests/clinical-ui/care-plan-editor-contract.cjs [--history]
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const sourcePath = 'interface/forms/care_plan/templates/care_plan_form.html.twig';
const fixturePath = 'tests/clinical-ui/fixtures/care-plan-form-original.html.twig.txt';
const ORIGINAL_SHA256 = 'b2ed29e663512c59a2296471a3caba6d3a9ed4c6ed10ee3e4f0b6c8952a72776';
const BODY = '<body>';
const HEAD = '</head>';

// The controller inserts this block immediately before </head> and changes <body> only.
const CSS = `<style>
@media screen {
  html.oe-workbench-context body.oe-care-plan-editor {
    margin: 0;
    background-color: #edf2f3;
    color: #182c36;
  }

  html.oe-workbench-context body.oe-care-plan-editor > .container.mt-3 {
    box-sizing: border-box;
    width: calc(100% - 2rem);
    max-width: 860px;
    margin-block: 1.5rem;
    margin-inline: auto;
    padding-block: 1.5rem;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-radius: 7px;
    background-color: #fff;
    color: #182c36;
  }

  html.oe-workbench-context body.oe-care-plan-editor > .container.mt-3 > .row {
    box-sizing: border-box;
    width: 100%;
    margin-inline: 0;
  }

  html.oe-workbench-context body.oe-care-plan-editor > .container.mt-3 > .row > .col-12 {
    min-width: 0;
    padding-inline: 0;
  }

  html.oe-workbench-context body.oe-care-plan-editor h2 {
    margin-block: 0 1rem;
    color: #182c36;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
  }

  html.oe-workbench-context body.oe-care-plan-editor fieldset {
    min-width: 0;
    margin-block: 0 1rem;
    padding: 0;
    border: 0;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-care-plan-editor legend {
    width: 100%;
    margin-block: 0 0.75rem;
    padding: 0;
    border: 0;
    background-color: #fff !important;
    color: #182c36 !important;
    font-size: 1rem;
    font-weight: 600;
  }

  html.oe-workbench-context body.oe-care-plan-editor #care-plan-rows-container {
    box-sizing: border-box;
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
  }

  html.oe-workbench-context body.oe-care-plan-editor .tb_row {
    min-width: 0;
    width: 100%;
  }

  html.oe-workbench-context body.oe-care-plan-editor .tb_row .form-row {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    margin-inline: 0;
  }

  html.oe-workbench-context body.oe-care-plan-editor .tb_row .forms {
    min-width: 0;
    padding-inline: 0.5rem;
  }

  html.oe-workbench-context body.oe-care-plan-editor .tb_row .forms.col-md-12 {
    padding-inline: 0;
  }

  html.oe-workbench-context body.oe-care-plan-editor .reasonCodeContainer > .card {
    min-width: 0;
    width: 100%;
    background-color: #fff;
    color: #182c36;
  }

  html.oe-workbench-context body.oe-care-plan-editor .reasonCodeContainer > .card > .card-header {
    background-color: #eef3f5;
    color: #182c36;
  }

  html.oe-workbench-context body.oe-care-plan-editor .tb_row textarea.description {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 12rem;
    line-height: 1.7;
    overflow-wrap: break-word;
    resize: vertical;
  }

  html.oe-workbench-context body.oe-care-plan-editor .btn-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    max-width: 100%;
  }

  html.oe-workbench-context body.oe-care-plan-editor .btn-group .btn {
    min-height: 2.5rem;
    white-space: normal;
  }

  html.oe-workbench-context body.oe-care-plan-editor .btn-save {
    background-color: #175b7c;
    border-color: #175b7c;
    color: #fff;
  }

  html.oe-workbench-context body.oe-care-plan-editor .btn-cancel {
    background-color: #dce5e9;
    border-color: #9baeb8;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-care-plan-editor .btn-cancel:hover {
    background: #dce5e9 !important;
  }

  html.oe-workbench-context body.oe-care-plan-editor .btn-save:focus,
  html.oe-workbench-context body.oe-care-plan-editor .btn-save:focus-visible {
    background-color: #175b7c;
    color: #fff;
  }

  html.oe-workbench-context body.oe-care-plan-editor .btn-cancel:focus,
  html.oe-workbench-context body.oe-care-plan-editor .btn-cancel:focus-visible {
    background-color: #dce5e9;
  }

  html.oe-workbench-context body.oe-care-plan-editor .btn-cancel:active {
    background-color: #dce5e9;
  }

  html.oe-workbench-context body.oe-care-plan-editor .tb_row textarea.description:focus,
  html.oe-workbench-context body.oe-care-plan-editor .tb_row input:focus,
  html.oe-workbench-context body.oe-care-plan-editor .tb_row select:focus,
  html.oe-workbench-context body.oe-care-plan-editor .btn-group .btn:focus {
    outline: 2px solid #216a91;
    outline-offset: 2px;
  }

  html.oe-workbench-context body.oe-care-plan-editor .tb_row textarea.description:focus-visible,
  html.oe-workbench-context body.oe-care-plan-editor .tb_row input:focus-visible,
  html.oe-workbench-context body.oe-care-plan-editor .tb_row select:focus-visible,
  html.oe-workbench-context body.oe-care-plan-editor .btn-group .btn:focus-visible {
    outline: 2px solid #216a91;
    outline-offset: 2px;
  }
}
</style>`;

const additions = [
    [HEAD, `${CSS}\n${HEAD}`],
    [BODY, '<body class="oe-care-plan-editor">']
];
const read = (relative) => fs.readFileSync(path.join(root, relative));
const git = (...args) => execFileSync('git', args, { cwd: root });
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function once(haystack, needle, label) {
    assert.ok(needle.length, `${label}: nonempty anchor`);
    const first = haystack.indexOf(needle);
    assert.notEqual(first, -1, `${label}: anchor present`);
    assert.equal(first, haystack.lastIndexOf(needle), `${label}: unique anchor`);
}

function replaceOnce(bytes, before, after, label) {
    const source = Buffer.from(bytes);
    const old = Buffer.from(before);
    once(source, old, label);
    const at = source.indexOf(old);
    return Buffer.concat([source.subarray(0, at), Buffer.from(after), source.subarray(at + old.length)]);
}

function proposed(bytes) {
    let result = Buffer.from(bytes);
    for (const [before, after] of additions) result = replaceOnce(result, before, after, 'original seam');
    return result;
}

function verifySource(source, baseline) {
    let inverse = Buffer.from(source);
    for (const [before, after] of additions) inverse = replaceOnce(inverse, after, before, 'complete exact addition');
    assert.deepEqual(inverse, baseline, 'complete source must invert to frozen original');
}

function original() {
    const bytes = read(fixturePath);
    assert.equal(hash(bytes), ORIGINAL_SHA256, 'fixture SHA256');
    return bytes;
}

function reasonRule(css, selector) {
    const opening = `  html.oe-workbench-context body.oe-care-plan-editor ${selector} {`;
    once(css, opening, `reason palette ${selector}`);
    const start = css.indexOf(opening);
    const end = css.indexOf('}', start + opening.length);
    assert.notEqual(end, -1, `reason palette ${selector}: closing brace`);
    return css.slice(start, end + 1);
}

function assertReasonPalette(css) {
    for (const [selector, background] of [
        ['.reasonCodeContainer > .card', '#fff'],
        ['.reasonCodeContainer > .card > .card-header', '#eef3f5']
    ]) {
        const rule = reasonRule(css, selector);
        assert.ok(rule.includes(`\n    background-color: ${background};\n`), `${selector}: background`);
        assert.ok(rule.includes('\n    color: #182c36;\n'), `${selector}: foreground`);
    }
}

function cancelRule(css, states) {
    const opening = states.map((state) =>
        `  html.oe-workbench-context body.oe-care-plan-editor .btn-cancel${state}`).join(',\n') + ' {';
    once(css, opening, `Cancel ${states.join('/')}`);
    const start = css.indexOf(opening);
    const end = css.indexOf('}', start + opening.length);
    assert.notEqual(end, -1, `Cancel ${states.join('/')}: closing brace`);
    return css.slice(start + opening.length, end).trim().split('\n').map((line) => line.trim());
}

function assertCancelPalette(css) {
    for (const [states, declarations] of [
        [[''], ['background-color: #dce5e9;', 'border-color: #9baeb8;', 'color: #182c36 !important;']],
        [[':hover'], ['background: #dce5e9 !important;']],
        [[':focus', ':focus-visible'], ['background-color: #dce5e9;']],
        [[':active'], ['background-color: #dce5e9;']]
    ]) assert.deepEqual(cancelRule(css, states), declarations, `Cancel ${states.join('/')}: exact palette`);
    assert.doesNotMatch(css, /\.btn-cancel:(?:disabled|invalid)/, 'disabled and validation states stay untouched');

    const important = [...css.matchAll(/\b([a-z-]+): ([^;\n]+) !important;/g)]
        .map((match) => `${match[1]}: ${match[2]}`).sort();
    assert.equal(important.length, (css.match(/!important/g) || []).length, 'all important declarations parsed');
    assert.deepEqual(important, [
        'background: #dce5e9',
        'background-color: #fff', 'background-color: #fff',
        'color: #182c36', 'color: #182c36', 'color: #182c36'
    ].sort(), 'exact important declaration allowlist');
}

const unchanged = [
    'interface/forms/care_plan/templates/partials/_care_plan_row.html.twig',
    'interface/forms/care_plan/templates/partials/_reason_row.html.twig',
    'interface/forms/care_plan/templates/partials/_actions.html.twig',
    'interface/forms/care_plan/careplan.js',
    'interface/forms/care_plan/new.php',
    'interface/forms/care_plan/view.php',
    'interface/forms/care_plan/save.php',
    'src/Controllers/Interface/Forms/CarePlan/CarePlanController.php',
    'src/Services/Forms/CarePlanFormService.php',
    'src/Core/Header.php',
    'config/config.yaml',
    'interface/clinical-workspace/popup.js'
];
const allowed = new Set([
    sourcePath, fixturePath,
    'tests/clinical-ui/care-plan-editor-contract.cjs',
    'tests/js/care-plan-editor.test.js',
    'docs/clinical-ui/CARE-PLAN-EDITOR.md'
]);
function checkScope(files) {
    for (const file of files) assert.ok(allowed.has(file), `out-of-scope changed path: ${file}`);
}

assert.deepEqual(process.argv.slice(2).filter((arg) => arg !== '--history'), [], 'unknown option');
const history = process.argv.includes('--history');

test('native workbench header supplies the context class', () => {
    assert.match(read('src/Core/Header.php').toString(), /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(read('config/config.yaml').toString(), /workbench-popup:\s*\n\s*basePath:.*clinical-workspace.*\n\s*script: popup\.js\s*\n\s*link: popup\.css\s*\n\s*autoload: true/);
    const popup = read('interface/clinical-workspace/popup.js').toString();
    assert.match(popup, /const CONTEXT_CLASS = 'oe-workbench-context'/);
    assert.match(popup, /set\(CONTEXT_CLASS, active\)/);
});

test('frozen Twig preserves form semantics, row loop and inert clone position', () => {
    const source = original().toString();
    const ordered = [
        'setupHeader([', 'careplan.js?v=', 'window.careplanForm.init(', '<body>',
        '<div class="container mt-3">', '<div class="row">', '<div class="col-12">',
        '<form method="post" name="my_form"', 'name="csrf_token_form" value="{{ csrfToken|attr }}"',
        '<fieldset>', 'id="care-plan-rows-container"',
        '{% for key, row in (rows is empty ? [{}] : rows) %}',
        "{% include '/forms/care_plan/templates/partials/_care_plan_row.html.twig' with {",
        '{% endfor %}', '</fieldset>', 'class="btn btn-primary btn-save"',
        'class="btn btn-secondary btn-cancel"', '</form>',
        '<template id="care-plan-row-template">', '</template>'
    ];
    let previous = -1;
    for (const item of ordered) {
        const at = source.indexOf(item, previous + 1);
        assert.ok(at > previous, `ordered native structure: ${item}`);
        previous = at;
    }
    assert.match(source, /action="{{ rootdir\|attr }}\/forms\/care_plan\/save\.php\?id={{ formId\|attr_url }}"/);
    assert.match(source, /onclick="top\.restoreSession\(\); parent\.closeTab\(window\.name, false\);"/);
    assert.match(source, /rowIndex: key \+ 1,[\s\S]*?authUser: authUser[\s\S]*?} only %}/);
    assert.match(source, /rowIndex: 0,[\s\S]*?authUser: ''[\s\S]*?} only %}/);
    assert.match(read('interface/forms/care_plan/templates/partials/_care_plan_row.html.twig').toString(), /<textarea name="description\[\]"[\s\S]*?{{ row\.description\|default\(''\)\|text }}<\/textarea>/);
    assert.match(read('interface/forms/care_plan/careplan.js').toString(), /template\.content\.querySelector\('\.tb_row'\)/);
});

test('CSS covers paper geometry, row widths, palette, focus and responsive actions', () => {
    assert.match(CSS, /^<style>\n@media screen \{/);
    assert.match(CSS, /max-width: 860px;/);
    assert.match(CSS, /width: calc\(100% - 2rem\);/);
    assert.match(CSS, /> \.row \{[\s\S]*?width: 100%;[\s\S]*?margin-inline: 0;/);
    assert.match(CSS, /#care-plan-rows-container \{[\s\S]*?width: 100%;[\s\S]*?padding: 0;/);
    assert.match(CSS, /\.tb_row \.form-row \{[\s\S]*?width: 100%;[\s\S]*?margin-inline: 0;/);
    assert.match(CSS, /\.tb_row \.forms\.col-md-12 \{\n    padding-inline: 0;/);
    assert.match(CSS, /textarea\.description \{[\s\S]*?width: 100%;[\s\S]*?min-height: 12rem;[\s\S]*?line-height: 1\.7;[\s\S]*?resize: vertical;/);
    for (const element of ['fieldset', 'legend']) {
        const rule = CSS.match(new RegExp(`body\\.oe-care-plan-editor ${element} \\{([^}]+)\\}`));
        assert.ok(rule, `${element} rule`);
        assert.match(rule[1], /background-color: #fff !important;/);
        assert.match(rule[1], /color: #182c36 !important;/);
    }
    for (const [button, background, ink] of [['save', '#175b7c', '#fff']]) {
        assert.match(CSS, new RegExp(`\\.btn-${button} \\{[^}]*background-color: ${background};[^}]*color: ${ink};`));
        assert.match(CSS, new RegExp(`\\.btn-${button}:focus,\\n[^}]*\\.btn-${button}:focus-visible \\{[^}]*background-color: ${background};[^}]*color: ${ink};`));
    }
    assert.match(CSS, /\.btn-group \{[\s\S]*?flex-wrap: wrap;/);
    for (const control of ['textarea.description', 'input', 'select', '.btn']) {
        assert.ok(CSS.includes(`${control}:focus`), `focus: ${control}`);
        assert.ok(CSS.includes(`${control}:focus-visible`), `focus visible: ${control}`);
    }
    assert.doesNotMatch(CSS, /@media print|<script|!important[^;]*font/);
});

test('reason card and header each keep a readable paired palette', () => {
    assertReasonPalette(CSS);
    for (const [selector, background] of [
        ['.reasonCodeContainer > .card', '#fff'],
        ['.reasonCodeContainer > .card > .card-header', '#eef3f5']
    ]) {
        const rule = reasonRule(CSS, selector);
        for (const [declaration, replacement] of [
            [`background-color: ${background};`, ''],
            ['color: #182c36;', ''],
            [`background-color: ${background};`, 'background-color: #000;'],
            ['color: #182c36;', `color: ${background};`]
        ]) {
            const damagedRule = replaceOnce(rule, declaration, replacement, 'reason color declaration').toString();
            const mutant = replaceOnce(CSS, rule, damagedRule, 'reason palette rule').toString();
            assert.notEqual(mutant, CSS, `${selector}: mutant changes ${declaration}`);
            assert.throws(() => assertReasonPalette(mutant), `${selector}: reject ${declaration}`);
        }
    }
});

test('Cancel keeps its scoped Solar-readable palette in every interactive state', () => {
    assertCancelPalette(CSS);
    const base = '  html.oe-workbench-context body.oe-care-plan-editor .btn-cancel {';
    const mutants = [
        ['color: #182c36 !important;', 'color: #182c36;'],
        ['color: #182c36 !important;', 'color: #dce5e9 !important;'],
        ['background-color: #dce5e9;\n    border-color: #9baeb8;', 'background-color: #182c36;\n    border-color: #9baeb8;'],
        ['background: #dce5e9 !important;', 'background: #dce5e9;'],
        ['background: #dce5e9 !important;', 'background: #182c36 !important;'],
        ['.btn-cancel:hover {', '.btn-cancel:disabled {'],
        ['.btn-cancel:focus-visible {', '.btn-cancel:invalid {'],
        ['.btn-cancel:active {', '.btn-cancel:disabled {'],
        [base, '  html body.oe-care-plan-editor .btn-cancel {'],
        ['border-color: #9baeb8;', 'border-color: #9baeb8 !important;']
    ];
    for (const [before, after] of mutants) {
        const damaged = replaceOnce(CSS, before, after, 'Cancel negative mutant').toString();
        assert.throws(() => assertCancelPalette(damaged), `reject Cancel mutant: ${before}`);
    }
});

test('synthetic proposal passes complete inverse before the actual template check', () => {
    const bytes = original();
    verifySource(proposed(bytes), bytes);
});

test('semantic, geometry, palette, focus and scope mutants fail the inverse', () => {
    const baseline = original();
    const candidate = proposed(baseline);
    const fieldsetRule = CSS.match(/  html\.oe-workbench-context body\.oe-care-plan-editor fieldset \{[^}]+\}/)[0];
    const legendRule = CSS.match(/  html\.oe-workbench-context body\.oe-care-plan-editor legend \{[^}]+\}/)[0];
    const focusRule = CSS.match(/  html\.oe-workbench-context body\.oe-care-plan-editor \.tb_row textarea\.description:focus,[^}]+\}/)[0];
    const mutants = [
        ['<template id="care-plan-row-template">', '<div id="care-plan-row-template">'],
        ['name="csrf_token_form" value="{{ csrfToken|attr }}"', 'name="csrf_token_form" value="{{ csrfToken }}"'],
        ['{{ rootdir|attr }}/forms/care_plan/save.php?id={{ formId|attr_url }}', '{{ rootdir }}/forms/care_plan/save.php?id={{ formId|attr_url }}'],
        ['{% for key, row in (rows is empty ? [{}] : rows) %}', '{% for key, row in rows %}'],
        ['rowIndex: key + 1,', 'rowIndex: key,'],
        ['</form>\n            </div>', '</form>\n            <div>moved</div>\n            </div>'],
        ['onclick="top.restoreSession(); parent.closeTab(window.name, false);"', 'onclick="parent.closeTab(window.name, false);"'],
        ['@media screen {', '@media print {'],
        ['max-width: 860px;', 'max-width: 1200px;'],
        ['width: calc(100% - 2rem);', 'width: 50%;'],
        ['html.oe-workbench-context body.oe-care-plan-editor > .container.mt-3 {', 'html body.oe-care-plan-editor > .container.mt-3 {'],
        ['#care-plan-rows-container {', '#other-rows-container {'],
        ['.tb_row .form-row {', '.tb_row .other-row {'],
        ['min-height: 12rem;', 'min-height: 2rem;'],
        ['flex-wrap: wrap;', 'flex-wrap: nowrap;'],
        [fieldsetRule, fieldsetRule.replace('background-color: #fff !important;', 'background-color: #fff;')],
        [fieldsetRule, fieldsetRule.replace('color: #182c36 !important;', 'color: #182c36;')],
        [legendRule, legendRule.replace('background-color: #fff !important;', 'background-color: #fff;')],
        ['.btn-save {', '.btn-other {'],
        ['.btn-cancel {', '.btn-other {'],
        ['.btn-cancel {\n    background-color: #dce5e9;', '.btn-cancel {\n    background-color: transparent;'],
        ['.btn-save {\n    background-color: #175b7c;\n    border-color: #175b7c;\n    color: #fff;', '.btn-save {\n    background-color: #175b7c;\n    border-color: #175b7c;\n    color: #222;'],
        ['.btn-cancel:focus,', '.btn-cancel:active,'],
        ['.tb_row input:focus,', '.tb_row input:active,'],
        [focusRule, focusRule.replace('outline: 2px solid #216a91;', 'outline: 0;')],
        ['</style>', '@media print { body { display: none; } }\n</style>']
    ];
    for (const [before, after] of mutants) {
        const changed = replaceOnce(candidate, before, after, 'negative mutant anchor');
        assert.throws(() => verifySource(changed, baseline), `reject ${before}`);
    }
    assert.throws(() => verifySource(baseline, baseline), 'unedited source is red');
});

test('five-path boundary rejects unrelated files', () => {
    assert.throws(() => checkScope([sourcePath, 'interface/forms/care_plan/careplan.js']), /out-of-scope/);
});

test('actual template contains exactly the proposed additions', () => {
    const baseline = original();
    const current = read(sourcePath);
    assert.notDeepEqual(current, baseline, 'presentation change is still missing');
    verifySource(current, baseline);
});

if (history) test('baseline, unchanged sources and complete five-path working tree scope', () => {
    git('merge-base', '--is-ancestor', BASE, 'HEAD');
    assert.deepEqual(original(), git('show', `${BASE}:${sourcePath}`), 'fixture equals exact baseline blob');
    for (const file of unchanged) assert.deepEqual(read(file), git('show', `${BASE}:${file}`), `${file} unchanged`);
    const changed = [
        ...git('diff', '--name-only', '-z', '--no-renames', BASE, '--').toString().split('\0'),
        ...git('ls-files', '--others', '--exclude-standard', '-z').toString().split('\0')
    ].filter(Boolean);
    checkScope(changed);
    for (const file of changed) {
        const absolute = path.join(root, file);
        if (fs.existsSync(absolute)) assert.ok(!fs.lstatSync(absolute).isSymbolicLink(), `symlink: ${file}`);
    }
});

module.exports = { CSS, additions, proposed, verifySource, original, sourcePath };
