'use strict';

// node --test-reporter=tap tests/clinical-ui/observation-editor-contract.cjs [--history]
// node tests/clinical-ui/observation-editor-contract.cjs --export-css
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const sourcePath = 'interface/forms/observation/templates/observation_edit.html.twig';
const fixturePath = 'tests/clinical-ui/fixtures/observation-edit-original.twig.txt';
const ORIGINAL_SHA256 = 'a144b8f0b503ba5e0e19817ed91e85e1a1bc4a6c2dff6b59ce17abe98e5b6eb0';
const prefix = 'html.oe-workbench-context body form.oe-observation-editor';
const HEAD = '    <link rel="stylesheet" href="{{ webroot }}/interface/forms/observation/observation.css?v={{ assetVersion|attr_url }}" type="text/css"/>\n{% endblock %}';
const FORM = '<form id="observation_form" method="post"';

// Export the complete style block for the controller's CSS check.
const CSS = `<style>
@media screen {
  html.oe-workbench-context body form.oe-observation-editor {
    box-sizing: border-box;
    width: min(100%, 860px);
    max-width: 860px;
    margin: 1.5rem auto 2rem;
    padding: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-radius: 7px;
    background-color: #fff !important;
    color: #182c36 !important;
    box-shadow: 0 8px 28px rgb(24 44 54 / 8%);
  }

  html.oe-workbench-context body form.oe-observation-editor .observation-cards-container,
  html.oe-workbench-context body form.oe-observation-editor .card,
  html.oe-workbench-context body form.oe-observation-editor .card-body {
    min-width: 0;
  }

  html.oe-workbench-context body form.oe-observation-editor .card {
    margin-bottom: 1.5rem !important;
    border: 1px solid #d5e0e3;
    border-radius: 5px;
    background-color: #fff !important;
    color: #182c36 !important;
    box-shadow: none;
  }

  html.oe-workbench-context body form.oe-observation-editor .card:hover {
    box-shadow: none;
  }

  html.oe-workbench-context body form.oe-observation-editor .card-header.bg-light {
    gap: 0.5rem;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid #d5e0e3;
    background-color: #edf3f4 !important;
    color: #183b49 !important;
    line-height: 1.4;
  }

  html.oe-workbench-context body form.oe-observation-editor .card-header .fa,
  html.oe-workbench-context body form.oe-observation-editor .card-header .text-primary,
  html.oe-workbench-context body form.oe-observation-editor .card-header .text-info,
  html.oe-workbench-context body form.oe-observation-editor .card-header .text-secondary,
  html.oe-workbench-context body form.oe-observation-editor .card-header .text-warning {
    color: #145968 !important;
  }

  html.oe-workbench-context body form.oe-observation-editor .card-body {
    padding: 1.25rem 1rem;
  }

  html.oe-workbench-context body form.oe-observation-editor .card-body .row {
    row-gap: 0.35rem;
  }

  html.oe-workbench-context body form.oe-observation-editor .form-group {
    margin-bottom: 1rem;
  }

  html.oe-workbench-context body form.oe-observation-editor .form-label {
    margin-bottom: 0.35rem;
    color: #183b49 !important;
    font-weight: 600;
  }

  html.oe-workbench-context body form.oe-observation-editor .form-control {
    min-width: 0;
    border-color: #9eb2ba;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body form.oe-observation-editor .form-control:focus {
    border-color: #145968;
    box-shadow: 0 0 0 0.2rem rgb(20 89 104 / 22%);
  }

  html.oe-workbench-context body form.oe-observation-editor textarea[name='observation'] {
    width: 100%;
    min-height: 12rem;
    line-height: 1.7;
    resize: vertical;
  }

  html.oe-workbench-context body form.oe-observation-editor .questionnaire-linked.bg-light,
  html.oe-workbench-context body form.oe-observation-editor .questionnaire-unlinked.bg-light {
    background: #f3f7f7 !important;
    color: #182c36 !important;
    overflow-wrap: anywhere;
  }

  html.oe-workbench-context body form.oe-observation-editor .questionnaire-linked.border-success {
    border-color: #28735a !important;
  }

  html.oe-workbench-context body form.oe-observation-editor .questionnaire-linked h6 {
    display: block;
    min-width: 0;
  }

  html.oe-workbench-context body form.oe-observation-editor .questionnaire-linked .questionnaire-name {
    display: block;
    overflow-wrap: anywhere;
  }

  html.oe-workbench-context body form.oe-observation-editor .questionnaire-unlinked {
    border-color: #728e98 !important;
  }

  html.oe-workbench-context body form.oe-observation-editor .questionnaire-linked .text-success,
  html.oe-workbench-context body form.oe-observation-editor .questionnaire-linked .fa-link {
    color: #236447 !important;
  }

  html.oe-workbench-context body form.oe-observation-editor .text-muted,
  html.oe-workbench-context body form.oe-observation-editor .questionnaire-unlinked .fa-file-text-o {
    color: #536773 !important;
  }

  html.oe-workbench-context body form.oe-observation-editor .response-id {
    background-color: #e2ecee;
    color: #183b49;
  }

  html.oe-workbench-context body form.oe-observation-editor .sub-observation.bg-white {
    min-width: 0;
    padding: 1rem !important;
    border-color: #cbd6da !important;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body form.oe-observation-editor .sub-observation > .d-flex,
  html.oe-workbench-context body form.oe-observation-editor .card-header.d-flex {
    flex-wrap: wrap;
    row-gap: 0.6rem;
  }

  html.oe-workbench-context body form.oe-observation-editor .reasonCodeContainer .code-selector-text-display {
    color: #183b49;
    overflow-wrap: anywhere;
  }

  html.oe-workbench-context body form.oe-observation-editor .action-bar.bg-light {
    position: static !important;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1.5rem;
    border-top: 1px solid #cbd6da !important;
    background-color: #edf3f4 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body form.oe-observation-editor .action-bar .btn-group {
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-left: auto;
  }

  html.oe-workbench-context body form.oe-observation-editor .btn {
    transition: none;
  }

  html.oe-workbench-context body form.oe-observation-editor .btn-primary {
    border: 1px solid #145968 !important;
    background: #145968 !important;
    color: #fff !important;
  }

  html.oe-workbench-context body form.oe-observation-editor .btn-primary:hover,
  html.oe-workbench-context body form.oe-observation-editor .btn-primary:active,
  html.oe-workbench-context body form.oe-observation-editor .btn-primary:focus {
    border-color: #0d4350 !important;
    background: #0d4350 !important;
    color: #fff !important;
  }

  html.oe-workbench-context body form.oe-observation-editor .btn-secondary {
    border: 1px solid #91a8b1 !important;
    background: #e4ecef !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body form.oe-observation-editor .btn-secondary:hover,
  html.oe-workbench-context body form.oe-observation-editor .btn-secondary:active,
  html.oe-workbench-context body form.oe-observation-editor .btn-secondary:focus {
    border-color: #708d98 !important;
    background: #d2e0e5 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body form.oe-observation-editor .btn-outline-primary {
    border-color: #145968 !important;
    background: #fff !important;
    color: #145968 !important;
  }

  html.oe-workbench-context body form.oe-observation-editor .btn-outline-primary:hover,
  html.oe-workbench-context body form.oe-observation-editor .btn-outline-primary:active,
  html.oe-workbench-context body form.oe-observation-editor .btn-outline-primary:focus {
    border-color: #0d4350 !important;
    background: #0d4350 !important;
    color: #fff !important;
  }

  html.oe-workbench-context body form.oe-observation-editor .btn-outline-danger {
    border-color: #913c36 !important;
    background: #fff !important;
    color: #913c36 !important;
  }

  html.oe-workbench-context body form.oe-observation-editor .btn-outline-danger:hover,
  html.oe-workbench-context body form.oe-observation-editor .btn-outline-danger:active,
  html.oe-workbench-context body form.oe-observation-editor .btn-outline-danger:focus,
  html.oe-workbench-context body form.oe-observation-editor .btn-danger {
    border-color: #913c36 !important;
    background: #913c36 !important;
    color: #fff !important;
  }

  html.oe-workbench-context body form.oe-observation-editor .btn-danger:hover,
  html.oe-workbench-context body form.oe-observation-editor .btn-danger:active,
  html.oe-workbench-context body form.oe-observation-editor .btn-danger:focus {
    border-color: #722b27 !important;
    background: #722b27 !important;
    color: #fff !important;
  }

  html.oe-workbench-context body form.oe-observation-editor .btn:focus-visible {
    outline: 3px solid #a84c22;
    outline-offset: 2px;
  }
}

@media screen and (width <= 640px) {
  html.oe-workbench-context body form.oe-observation-editor {
    margin: 0.75rem auto;
    padding: 1rem;
  }

  html.oe-workbench-context body form.oe-observation-editor .questionnaire-linked > .d-flex {
    flex-wrap: wrap;
    gap: 1rem;
  }

  html.oe-workbench-context body form.oe-observation-editor .questionnaire-linked .btn-group-vertical {
    width: 100%;
  }

  html.oe-workbench-context body form.oe-observation-editor .action-bar .btn-group {
    width: 100%;
    margin-left: 0;
  }
}
</style>`;

const additions = [
    [HEAD, HEAD.replace('{% endblock %}', `${CSS}\n{% endblock %}`)],
    [FORM, '<form id="observation_form" class="oe-observation-editor" method="post"']
];
const read = (relative) => fs.readFileSync(path.join(root, relative));
const git = (...args) => execFileSync('git', args, { cwd: root });
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function replaceOnce(bytes, before, after) {
    const source = Buffer.from(bytes);
    const needle = Buffer.from(before);
    const at = source.indexOf(needle);
    assert.notEqual(at, -1, `missing unique seam: ${before.slice(0, 60)}`);
    assert.equal(at, source.lastIndexOf(needle), 'seam must be unique');
    return Buffer.concat([source.subarray(0, at), Buffer.from(after), source.subarray(at + needle.length)]);
}

function original() {
    const bytes = read(fixturePath);
    assert.equal(bytes.length, 28870, 'frozen original byte count');
    assert.equal(hash(bytes), ORIGINAL_SHA256, 'frozen original SHA256');
    return bytes;
}

function proposed(bytes) {
    return additions.reduce((value, [before, after]) => replaceOnce(value, before, after), Buffer.from(bytes));
}

function verifySource(source, baseline = original()) {
    const inverse = [...additions].reverse().reduce((value, [before, after]) => replaceOnce(value, after, before), Buffer.from(source));
    assert.deepEqual(inverse, baseline, 'inverse preserves every original byte');
}

function rules(css) {
    return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
        selectors: match[1].split(',').map((selector) => selector.trim()),
        body: match[2]
    }));
}

function assertScoped(css) {
    for (const rule of rules(css)) {
        for (const selector of rule.selectors) {
            assert.ok(selector === prefix || selector.startsWith(`${prefix} `), `scoped selector: ${selector}`);
        }
    }
}

function assertRule(css, selector, declarations) {
    const matches = rules(css).filter((rule) => rule.selectors.includes(`${prefix} ${selector}`));
    assert.ok(matches.length > 0, `selector present: ${selector}`);
    for (const declaration of declarations) {
        assert.ok(matches.some((rule) => rule.body.includes(declaration)), `${selector}: ${declaration}`);
    }
}

function mutateRule(css, selector, before, after) {
    const start = css.indexOf(`${prefix} ${selector} {`);
    assert.notEqual(start, -1, `mutant selector: ${selector}`);
    const end = css.indexOf('}', start);
    const block = css.slice(start, end);
    assert.ok(block.includes(before), `mutant declaration: ${before}`);
    return css.slice(0, start) + block.replace(before, after) + css.slice(end);
}

const allowed = new Set([
    sourcePath, fixturePath, 'tests/clinical-ui/observation-editor-contract.cjs',
    'tests/js/observation-editor.test.js', 'docs/clinical-ui/OBSERVATION-EDITOR.md'
]);
function checkScope(files) {
    for (const file of files) assert.ok(allowed.has(file), `out-of-scope path: ${file}`);
}

const args = process.argv.slice(2);
assert.ok(args.every((arg) => arg === '--history' || arg === '--export-css') && new Set(args).size === args.length && !(args.includes('--history') && args.includes('--export-css')), 'unknown or conflicting option');
if (args.includes('--export-css')) {
    process.stdout.write(CSS);
} else {
    test('frozen source retains native form, CSRF, values, includes and actions', () => {
        const source = original().toString();
        for (const item of [
            FORM, 'name="csrf_token_form"', 'name="questionnaire_response_fhir_id"',
            'name="observation"', 'name="ob_reason_code"', 'name="ob_reason_status"',
            'sub_observations is not empty', '_sub-observation.html.twig',
            'id="questionnaire-dialog-template"', 'id="templates"',
            'observationForm.init(', 'btn-cancel', 'reason-code-btn', 'Save Observation'
        ]) assert.ok(source.includes(item), `native source: ${item}`);
    });

    test('screen document, comments, metadata, linked state, sub-observations and actions are scoped', () => {
        assert.match(CSS, /^<style>\n@media screen \{/);
        assert.match(CSS, /max-width: 860px;/);
        assert.match(CSS, /textarea\[name='observation'\] \{[^}]*min-height: 12rem;[^}]*line-height: 1\.7;[^}]*resize: vertical;/);
        for (const selector of ['.card-header.bg-light', '.card-body .row', '.form-label', '.questionnaire-linked.bg-light', '.questionnaire-unlinked.bg-light', '.sub-observation.bg-white', '.reasonCodeContainer .code-selector-text-display', '.action-bar.bg-light']) assert.ok(CSS.includes(selector), selector);
        assert.match(CSS, /\.action-bar\.bg-light \{[^}]*position: static !important;/);
        assert.match(CSS, /@media screen and \(width <= 640px\)/);
        assert.doesNotMatch(CSS, /@media print|<script|#templates|dialog-template|display: none/);
        assertScoped(CSS);
    });

    test('paired theme palettes cover inputs, backgrounds, text and button states', () => {
        for (const [selector, declarations] of [
            ['.card-header.bg-light', ['background-color: #edf3f4 !important;', 'color: #183b49 !important;']],
            ['.questionnaire-linked.bg-light', ['background: #f3f7f7 !important;', 'color: #182c36 !important;']],
            ['.sub-observation.bg-white', ['background-color: #fff !important;', 'color: #182c36 !important;']],
            ['.form-control', ['background-color: #fff !important;', 'color: #182c36 !important;']],
            ['.text-muted', ['color: #536773 !important;']],
            ['.btn-primary', ['background: #145968 !important;', 'color: #fff !important;']],
            ['.btn-secondary', ['background: #e4ecef !important;', 'color: #182c36 !important;']],
            ['.btn-outline-primary', ['background: #fff !important;', 'color: #145968 !important;']],
            ['.btn-outline-danger', ['background: #fff !important;', 'color: #913c36 !important;']],
            ['.btn-secondary:hover', ['background: #d2e0e5 !important;', 'color: #182c36 !important;']],
            ['.btn-secondary:active', ['background: #d2e0e5 !important;', 'color: #182c36 !important;']],
            ['.btn-danger:hover', ['background: #722b27 !important;', 'color: #fff !important;']]
        ]) assertRule(CSS, selector, declarations);
        assertRule(CSS, '.btn:focus-visible', ['outline: 3px solid #a84c22;']);
    });

    test('linked status stays a block and questionnaire name wraps independently', () => {
        assertRule(CSS, '.questionnaire-linked h6', ['display: block;', 'min-width: 0;']);
        assertRule(CSS, '.questionnaire-linked .questionnaire-name', ['display: block;', 'overflow-wrap: anywhere;']);
        for (const [before, after, selector, declaration] of [
            ['display: block;', 'display: flex;', '.questionnaire-linked h6', 'display: block;'],
            ['min-width: 0;', 'min-width: auto;', '.questionnaire-linked h6', 'min-width: 0;'],
            ['display: block;', 'display: inline;', '.questionnaire-linked .questionnaire-name', 'display: block;'],
            ['overflow-wrap: anywhere;', 'overflow-wrap: normal;', '.questionnaire-linked .questionnaire-name', 'overflow-wrap: anywhere;']
        ]) {
            const mutated = mutateRule(CSS, selector, before, after);
            assert.throws(() => assertRule(mutated, selector, [declaration]), `linked heading mutant: ${selector} ${before}`);
        }
        assertRule(read(sourcePath).toString(), '.questionnaire-linked h6', ['display: block;', 'min-width: 0;']);
        assertRule(read(sourcePath).toString(), '.questionnaire-linked .questionnaire-name', ['display: block;', 'overflow-wrap: anywhere;']);
    });

    test('form buttons switch paired colors without transition', () => {
        assertRule(CSS, '.btn', ['transition: none;']);
        const mutated = mutateRule(CSS, '.btn', 'transition: none;', 'transition: all 0.3s ease;');
        assert.throws(() => assertRule(mutated, '.btn', ['transition: none;']), 'transition mutant');
        assertRule(read(sourcePath).toString(), '.btn', ['transition: none;']);
    });

    test('synthetic proposal passes byte-exact inverse', () => verifySource(proposed(original())));

    test('individual semantic, layout, palette and scope mutants fail', () => {
        const baseline = original();
        const candidate = proposed(baseline);
        for (const [before, after] of [
            ['name="csrf_token_form"', 'name="other_token"'],
            ['name="observation"', 'name="other_observation"'],
            ["textarea[name='observation']", "textarea[name='other_observation']"],
            ['{% for index,subObservation in observation.sub_observations %}', '{% for subObservation in observation.sub_observations %}'],
            ['max-width: 860px;', 'max-width: 1200px;'],
            ['min-height: 12rem;', 'min-height: 2rem;'],
            ['line-height: 1.7;', 'line-height: 1;'],
            ['resize: vertical;', 'resize: none;'],
            ['background: #145968 !important;', 'background: #fff !important;'],
            ['position: static !important;', 'position: fixed !important;'],
            ['@media screen {', '@media print {'],
            ['outline: 3px solid #a84c22;', 'outline: 0;'],
            ['class="oe-observation-editor"', 'class="other"']
        ]) assert.throws(() => verifySource(replaceOnce(candidate, before, after), baseline), `mutant: ${before}`);
        assert.throws(() => verifySource(baseline, baseline), 'unedited source is red');
        assert.throws(() => assertScoped(CSS.replace(`${prefix} .observation-cards-container,`, 'body .observation-cards-container,')), 'unscoped comma member');
        assert.throws(() => assertRule(CSS.replace('background-color: #edf3f4 !important;', 'background-color: #edf3f4;'), '.card-header.bg-light', ['background-color: #edf3f4 !important;']), 'theme override removed');
    });

    test('five-path boundary rejects unrelated files', () => {
        checkScope([...allowed]);
        assert.throws(() => checkScope(['interface/forms/observation/observation.css']), /out-of-scope/);
    });

    test('actual source contains exactly the two additions', () => {
        const baseline = original();
        const current = read(sourcePath);
        assert.notDeepEqual(current, baseline, 'presentation addition is missing');
        verifySource(current, baseline);
    });

    if (args.includes('--history')) test('base-to-HEAD and working scope retain frozen original', () => {
        git('merge-base', '--is-ancestor', BASE, 'HEAD');
        assert.deepEqual(original(), git('show', `${BASE}:${sourcePath}`));
        const split = (bytes) => bytes.toString().split('\0').filter(Boolean);
        const changed = [
            ...split(git('diff', '--name-only', '-z', '--no-renames', BASE, 'HEAD', '--')),
            ...split(git('diff', '--name-only', '-z', '--no-renames', 'HEAD', '--')),
            ...split(git('diff', '--cached', '--name-only', '-z', '--no-renames', '--')),
            ...split(git('ls-files', '--others', '--exclude-standard', '-z'))
        ];
        checkScope(changed);
        for (const file of changed) if (fs.existsSync(path.join(root, file))) assert.ok(!fs.lstatSync(path.join(root, file)).isSymbolicLink(), `symlink: ${file}`);
    });
}

module.exports = { CSS, original, proposed, verifySource, sourcePath };
