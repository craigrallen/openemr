'use strict';

// Portable contract: node --test-reporter=tap tests/clinical-ui/functional-cognitive-editor-contract.cjs --history
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const sourcePath = 'interface/forms/functional_cognitive_status/new.php';
const fixturePath = 'tests/clinical-ui/fixtures/functional-cognitive-new-original.php.txt';
const savePath = 'interface/forms/functional_cognitive_status/save.php';
const viewPath = 'interface/forms/functional_cognitive_status/view.php';
const ORIGINAL_SHA256 = 'd3532e9d47301f238983f291639ddb9399eaf13ebbe501b64736ae7add3abc17';
const HEAD = '</head>';
const BODY = '<body>';
const CSS = `<style>
@media screen {
  html.oe-workbench-context body.oe-functional-cognitive-editor {
    margin: 0;
    background-color: #edf2f3 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor > .container.mt-3 {
    box-sizing: border-box;
    width: calc(100% - 2rem);
    max-width: 860px;
    margin-block: 1.5rem;
    margin-inline: auto;
    padding-block: 1.5rem;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-radius: 7px;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor > .container.mt-3 > .row {
    box-sizing: border-box;
    width: 100%;
    margin-inline: 0;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor > .container.mt-3 > .row > .col-12 {
    min-width: 0;
    padding-inline: 0;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor h2 {
    margin-block: 0 1rem;
    color: #182c36;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor fieldset {
    min-width: 0;
    margin-block: 0 1rem;
    padding: 0;
    border: 0;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor legend {
    width: 100%;
    margin-block: 0 0.75rem;
    padding: 0;
    border: 0;
    color: #182c36;
    font-size: 1rem;
    font-weight: 600;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor fieldset > .container {
    box-sizing: border-box;
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor .tb_row {
    margin-block: 0 1rem;
    padding-block: 0 1rem;
    border-bottom: 1px solid #cbd6da;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor .tb_row > .form-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    width: 100%;
    margin: 0;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor .tb_row > .form-row > .forms {
    box-sizing: border-box;
    min-width: 0;
    width: 100%;
    max-width: none;
    padding: 0;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor .tb_row > .form-row > .forms:nth-child(4) {
    grid-column: 1 / -1;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor .tb_row > .form-row > .forms:nth-child(5) {
    display: flex;
    grid-column: 1 / -1;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor .tb_row .form-control {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor .tb_row textarea.description {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 12rem;
    padding-block: 0.65rem;
    padding-inline: 0.75rem;
    border: 1px solid #a9bbc3;
    border-radius: 4px;
    background-color: #fff !important;
    color: #182c36 !important;
    font: inherit;
    line-height: 1.7;
    overflow-wrap: break-word;
    resize: vertical;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor .form-group > .position-override {
    min-width: 0;
    padding-inline: 0;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor .btn-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    max-width: 100%;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor .btn-group .btn {
    min-height: 2.5rem;
    white-space: normal;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor .btn-group .btn-save {
    border-color: #145968 !important;
    background-color: #145968 !important;
    color: #fff !important;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor .btn-group .btn-save:hover,
  html.oe-workbench-context body.oe-functional-cognitive-editor .btn-group .btn-save:focus,
  html.oe-workbench-context body.oe-functional-cognitive-editor .btn-group .btn-save:active {
    border-color: #0d414d !important;
    background-color: #0d414d !important;
    color: #fff !important;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor .btn-group .btn-cancel {
    border-color: #536773 !important;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor .btn-group .btn-cancel:hover,
  html.oe-workbench-context body.oe-functional-cognitive-editor .btn-group .btn-cancel:focus,
  html.oe-workbench-context body.oe-functional-cognitive-editor .btn-group .btn-cancel:active {
    border-color: #182c36 !important;
    background-color: #e4f0f1 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-functional-cognitive-editor .tb_row textarea.description:focus,
  html.oe-workbench-context body.oe-functional-cognitive-editor .btn-group .btn:focus,
  html.oe-workbench-context body.oe-functional-cognitive-editor .tb_row textarea.description:focus-visible,
  html.oe-workbench-context body.oe-functional-cognitive-editor .btn-group .btn:focus-visible {
    outline: 2px solid #216a91;
    outline-offset: 2px;
  }
}

@media screen and (width <= 600px) {
  html.oe-workbench-context body.oe-functional-cognitive-editor .tb_row > .form-row {
    grid-template-columns: 1fr;
  }
}
</style>`;

const read = (relative) => fs.readFileSync(path.join(root, relative));
const git = (...args) => execFileSync('git', args, { cwd: root });
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
function once(bytes, anchor, label) {
    assert.ok(anchor.length, `${label}: nonempty anchor`);
    assert.notEqual(bytes.indexOf(anchor), -1, `${label}: anchor present`);
    assert.equal(bytes.indexOf(anchor), bytes.lastIndexOf(anchor), `${label}: unique anchor`);
}
const additions = [
    [HEAD, `${CSS}\n${HEAD}`],
    [BODY, '<body class="oe-functional-cognitive-editor">']
];
function proposed(original) {
    let candidate = Buffer.from(original);
    for (const [before, after] of additions) {
        once(candidate, Buffer.from(before), 'original seam');
        candidate = Buffer.from(candidate.toString('utf8').replace(before, after));
    }
    return candidate;
}
function verifySource(source, original) {
    let inverse = Buffer.from(source);
    for (const [before, after] of additions) {
        once(inverse, Buffer.from(after), 'complete exact addition');
        inverse = Buffer.from(inverse.toString('utf8').replace(after, before));
    }
    assert.deepEqual(inverse, original, 'whole original byte sequence preserved');
}
function original() {
    const bytes = read(fixturePath);
    assert.equal(hash(bytes), ORIGINAL_SHA256, 'complete original SHA-256');
    return bytes;
}
function checkScope(files) {
    const allowed = new Set([
        sourcePath, fixturePath,
        'tests/clinical-ui/functional-cognitive-editor-contract.cjs',
        'tests/js/functional-cognitive-editor.test.js',
        'docs/clinical-ui/FUNCTIONAL-COGNITIVE-EDITOR.md'
    ]);
    for (const file of files) assert.ok(allowed.has(file), `out-of-scope changed path: ${file}`);
}
const history = process.argv.slice(2).includes('--history');
assert.deepEqual(process.argv.slice(2).filter((arg) => arg !== '--history'), [], 'unknown option');
assert.ok(process.argv.slice(2).filter((arg) => arg === '--history').length <= 1, 'duplicate --history');

test('five-path boundary rejects save, view and unrelated changes', () => {
    assert.throws(() => checkScope([sourcePath, savePath]), /out-of-scope/);
    assert.throws(() => checkScope([viewPath]), /out-of-scope/);
});
test('native Header supplies the real workbench context', () => {
    assert.match(read('src/Core/Header.php').toString(), /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(read('config/config.yaml').toString(), /workbench-popup:\s*\n\s*basePath:.*clinical-workspace.*\n\s*script: popup\.js\s*\n\s*link: popup\.css\s*\n\s*autoload: true/);
    const popup = read('interface/clinical-workspace/popup.js').toString();
    assert.match(popup, /const CONTEXT_CLASS = 'oe-workbench-context'/);
    assert.match(popup, /set\(CONTEXT_CLASS, active\)/);
});
test('fixed CSS gives a full-width writing area and reachable row controls', () => {
    assert.match(CSS, /^<style>\n@media screen \{/);
    assert.match(CSS, /max-width: 860px;/);
    assert.match(CSS, /padding-inline: clamp\(1rem, 4vw, 2\.25rem\);/);
    assert.match(CSS, /\.form-row \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
    assert.match(CSS, /\.forms:nth-child\(4\) \{\n    grid-column: 1 \/ -1;/);
    assert.match(CSS, /\.forms:nth-child\(5\) \{[\s\S]*?grid-column: 1 \/ -1;[\s\S]*?flex-wrap: wrap;/);
    assert.match(CSS, /textarea\.description \{[\s\S]*?width: 100%;[\s\S]*?min-height: 12rem;[\s\S]*?line-height: 1\.7;[\s\S]*?resize: vertical;/);
    assert.match(CSS, /\.btn-group \{[\s\S]*?flex-wrap: wrap;/);
    assert.match(CSS, /@media screen and \(width <= 600px\) \{[\s\S]*?grid-template-columns: 1fr;/);
    assert.doesNotMatch(CSS, /@media print|<script|@import/);
});
test('paper, ink, actions and focus are paired for compiled themes', () => {
    for (const selector of ['> .container.mt-3', 'fieldset', 'fieldset > .container', '.tb_row textarea.description']) {
        const block = CSS.split(` ${selector} {`)[1]?.split('\n  }')[0];
        assert.ok(block, `rule exists: ${selector}`);
        assert.match(block, /background-color: #[0-9a-f]+ !important;/);
        assert.match(block, /color: #[0-9a-f]+ !important;/);
    }
    for (const action of ['save', 'cancel']) {
        const rest = CSS.split(`.btn-${action} {`)[1]?.split('\n  }')[0];
        const states = CSS.split(`.btn-${action}:active {`)[1]?.split('\n  }')[0];
        for (const block of [rest, states]) {
            assert.ok(block, `${action} palette block exists`);
            assert.match(block, /border-color: #[0-9a-f]+ !important;/);
            assert.match(block, /background-color: #[0-9a-f]+ !important;/);
            assert.match(block, /color: #[0-9a-f]+ !important;/);
        }
        assert.match(CSS, new RegExp(`\\.btn-${action}:hover,`));
        assert.match(CSS, new RegExp(`\\.btn-${action}:focus,`));
    }
    assert.match(CSS, /textarea\.description:focus-visible,/);
    assert.match(CSS, /\.btn-group \.btn:focus-visible \{\n    outline: 2px solid #216a91;/);
});
test('frozen source preserves both row variants, data path and save actions', () => {
    const bytes = original().toString();
    assert.match(bytes, /SELECT \* FROM `form_functional_cognitive_status` WHERE id=\? AND pid = \? AND encounter = \?/);
    assert.match(bytes, /CsrfUtils::collectCsrfToken\(session: \$session\)/);
    assert.match(bytes, /save\.php\?id=<\?php echo attr\(\$formid\); \?>/);
    assert.equal((bytes.match(/class="forms col-md-4"/g) || []).length, 2);
    assert.equal((bytes.match(/name="description\[\]"/g) || []).length, 2);
    assert.match(bytes, /duplicateRow\(this\.parentElement\.parentElement\.parentElement\)/);
    assert.match(bytes, /deleteRow\(this\.parentElement\.parentElement\.parentElement\.id\)/);
    assert.match(bytes, /top\.restoreSession\(\)/);
    assert.match(bytes, /parent\.closeTab\(window\.name, false\)/);
    assert.equal(read(viewPath).toString().includes('require("new.php");'), true);
    const save = read(savePath).toString();
    assert.match(save, /CsrfUtils::checkCsrfInput\(INPUT_POST, dieOnFail: true\)/);
    assert.match(save, /\$code_des = \$_POST\["description"\]/);
    assert.match(save, /\$code_activity = \$_POST\["activity1"\]/);
});
test('synthetic exact proposal passes whole-byte inverse', () => {
    const bytes = original();
    verifySource(proposed(bytes), bytes);
});
test('semantic, geometry, context, palette, focus and order mutants are rejected', () => {
    const bytes = original();
    const candidate = proposed(bytes).toString();
    const mutations = [
        ['CsrfUtils::collectCsrfToken(session: $session)', 'CsrfUtils::otherToken(session: $session)'],
        ['SELECT * FROM `form_functional_cognitive_status`', 'SELECT id FROM `form_functional_cognitive_status`'],
        ['name="description[]"  id="description_1"', 'name="other[]"  id="description_1"'],
        ['text($obj["description"] ?? \'\')', 'attr($obj["description"] ?? \'\')'],
        ['onclick="top.restoreSession()" class="btn btn-primary btn-save"', 'onclick="void 0" class="btn btn-primary btn-save"'],
        ['onclick="top.restoreSession(); parent.closeTab(window.name, false)"', 'onclick="void 0"'],
        ['@media screen {', '@media print {'],
        ['html.oe-workbench-context body.oe-functional-cognitive-editor {', 'html body.oe-functional-cognitive-editor {'],
        ['max-width: 860px;', 'max-width: 1200px;'],
        ['@media screen and (width <= 600px) {', '@media print and (width <= 600px) {'],
        ['padding-inline: clamp(1rem, 4vw, 2.25rem);', 'padding-inline: 8rem;'],
        ['.forms:nth-child(4) {\n    grid-column: 1 / -1;', '.forms:nth-child(4) {\n    grid-column: auto;'],
        ['min-height: 12rem;', 'min-height: 2rem;'],
        ['line-height: 1.7;', 'line-height: 1;'],
        ['resize: vertical;', 'resize: none;'],
        ['.btn-group {\n    display: flex;\n    flex-wrap: wrap;', '.btn-group {\n    display: flex;\n    flex-wrap: nowrap;'],
        ['.btn-save {\n    border-color: #145968 !important;\n    background-color: #145968 !important;\n    color: #fff !important;', '.btn-save {\n    border-color: #145968 !important;\n    background-color: transparent;\n    color: #fff !important;'],
        ['.btn-cancel {\n    border-color: #536773 !important;\n    background-color: #fff !important;\n    color: #182c36 !important;', '.btn-cancel {\n    border-color: #536773 !important;\n    background-color: #fff !important;\n    color: transparent;'],
        ['.btn-save:hover,', '.btn-save.disabled,'],
        ['.btn-cancel:focus,', '.btn-cancel.disabled,'],
        ['outline: 2px solid #216a91;', 'outline: 0;'],
        ['</style>', '@media print { body { display: none; } }\n</style>'],
        ['</body>', '<div>unexpected</div>\n</body>']
    ];
    for (const [before, after] of mutations) {
        once(Buffer.from(candidate), Buffer.from(before), `negative anchor ${before}`);
        assert.throws(() => verifySource(Buffer.from(candidate.replace(before, after)), bytes), `reject ${before}`);
    }
    assert.throws(() => verifySource(bytes, bytes), 'untouched route lacks additions');
});
test('actual route has the exact presentation additions', () => {
    const bytes = original();
    const current = read(sourcePath);
    assert.notDeepEqual(current, bytes, 'expected genuine source RED until implementation');
    verifySource(current, bytes);
});
if (history) test('base blobs, unchanged save/view and full changed-path scope', () => {
    git('merge-base', '--is-ancestor', BASE, 'HEAD');
    assert.deepEqual(original(), git('show', `${BASE}:${sourcePath}`), 'fixture equals base blob');
    for (const file of [savePath, viewPath]) {
        assert.deepEqual(read(file), git('show', `${BASE}:${file}`), `${file} remains at base`);
    }
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

module.exports = { original, proposed, CSS, verifySource, sourcePath };
