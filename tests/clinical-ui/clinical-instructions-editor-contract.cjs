'use strict';

// Direct portable invocation; --history is a script argument, not a node --test option.
// node --test-reporter=tap tests/clinical-ui/clinical-instructions-editor-contract.cjs
// node --test-reporter=tap tests/clinical-ui/clinical-instructions-editor-contract.cjs --history
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const sourcePath = 'interface/forms/clinical_instructions/new.php';
const fixturePath = 'tests/clinical-ui/fixtures/clinical-instructions-new-original.php.txt';
const viewPath = 'interface/forms/clinical_instructions/view.php';
const savePath = 'interface/forms/clinical_instructions/save.php';
const ORIGINAL_SHA256 = 'a4b0b3fba8ebf54a8fd5268abd66375dafdbff531af546e652e2cfcf7c468382';
const HEADER = '        <?php Header::setupHeader(); ?>';
const BODY = '    <body>';

// Exact implementation export: insert after HEADER and add the body class only.
const CSS = `<style>
@media screen {
  html.oe-workbench-context body.oe-clinical-instructions-editor {
    margin: 0;
    background-color: #edf2f3 !important;
    color: #182c36;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor > .container.mt-3 {
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

  html.oe-workbench-context body.oe-clinical-instructions-editor > .container.mt-3 > .row {
    box-sizing: border-box;
    width: 100%;
    margin-inline: 0;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor > .container.mt-3 > .row > .col-12 {
    min-width: 0;
    padding-inline: 0;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor h2 {
    margin-block: 0 1rem;
    color: #182c36;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor fieldset {
    min-width: 0;
    margin-block: 0 1rem;
    padding: 0;
    border: 0;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor legend {
    width: 100%;
    margin-block: 0 0.75rem;
    padding: 0;
    border: 0;
    color: #182c36;
    font-size: 1rem;
    font-weight: 600;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor fieldset > .container {
    box-sizing: border-box;
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
    background-color: #fff;
    color: #182c36;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor fieldset .form-group {
    margin-block: 0;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor textarea#instruction {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 12rem;
    padding-block: 0.65rem;
    padding-inline: 0.75rem;
    border: 1px solid #a9bbc3;
    border-radius: 4px;
    background-color: #fff;
    color: #182c36;
    font: inherit;
    line-height: 1.7;
    overflow-wrap: break-word;
    resize: vertical;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor .btn-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    max-width: 100%;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor .btn-group .btn {
    min-height: 2.5rem;
    white-space: normal;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor textarea#instruction:focus,
  html.oe-workbench-context body.oe-clinical-instructions-editor .btn-group .btn:focus {
    outline: 2px solid #216a91;
    outline-offset: 2px;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor textarea#instruction:focus-visible,
  html.oe-workbench-context body.oe-clinical-instructions-editor .btn-group .btn:focus-visible {
    outline: 2px solid #216a91;
    outline-offset: 2px;
  }
}
</style>`;

const read = (relative) => fs.readFileSync(path.join(root, relative));
const git = (...args) => execFileSync('git', args, { cwd: root });
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
function once(bytes, anchor, label) {
    assert.ok(anchor.length, `${label}: nonempty anchor`);
    assert.equal(bytes.indexOf(anchor), bytes.lastIndexOf(anchor), `${label}: unique anchor`);
    assert.notEqual(bytes.indexOf(anchor), -1, `${label}: anchor present`);
}
const additions = [
    [HEADER, `${HEADER}\n${CSS}`],
    [BODY, '    <body class="oe-clinical-instructions-editor">']
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
    assert.equal(hash(bytes), ORIGINAL_SHA256, 'complete fixture hash');
    return bytes;
}
function checkScope(files) {
    const allowed = new Set([
        sourcePath, fixturePath,
        'tests/clinical-ui/clinical-instructions-editor-contract.cjs',
        'tests/js/clinical-instructions-editor.test.js',
        'docs/clinical-ui/CLINICAL-INSTRUCTIONS-EDITOR.md'
    ]);
    for (const file of files) assert.ok(allowed.has(file), `out-of-scope changed path: ${file}`);
}
const history = process.argv.includes('--history');
assert.deepEqual(process.argv.slice(2).filter((arg) => arg !== '--history'), [], 'unknown option');

test('five-path boundary rejects unrelated changes', () => {
    assert.throws(() => checkScope([sourcePath, viewPath]), /out-of-scope/);
});
test('Header already supplies native workbench context', () => {
    assert.match(read('src/Core/Header.php').toString(), /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(read('config/config.yaml').toString(), /workbench-popup:\s*\n\s*basePath:.*clinical-workspace.*\n\s*script: popup\.js\s*\n\s*link: popup\.css\s*\n\s*autoload: true/);
    const popup = read('interface/clinical-workspace/popup.js').toString();
    assert.match(popup, /const CONTEXT_CLASS = 'oe-workbench-context'/);
    assert.match(popup, /set\(CONTEXT_CLASS, active\)/);
});
test('exact CSS is screen scoped and specifies full paper width, writing and actions', () => {
    assert.match(CSS, /^<style>\n@media screen \{/);
    assert.match(CSS, /html\.oe-workbench-context body\.oe-clinical-instructions-editor/);
    assert.match(CSS, /max-width: 860px;/);
    assert.match(CSS, /> \.row \{\n    box-sizing: border-box;\n    width: 100%;\n    margin-inline: 0;/);
    assert.match(CSS, /fieldset > \.container \{[\s\S]*?width: 100%;[\s\S]*?padding: 0;/);
    assert.match(CSS, /html\.oe-workbench-context body\.oe-clinical-instructions-editor fieldset \{\n    min-width: 0;\n    margin-block: 0 1rem;\n    padding: 0;\n    border: 0;\n    background-color: #fff !important;\n    color: #182c36 !important;\n  \}/);
    assert.match(CSS, /textarea#instruction \{[\s\S]*?width: 100%;[\s\S]*?min-height: 12rem;/);
    assert.match(CSS, /\.btn-group \{[\s\S]*?flex-wrap: wrap;/);
    assert.match(CSS, /:focus \{[\s\S]*?outline: 2px solid/);
    assert.match(CSS, /:focus-visible \{[\s\S]*?outline: 2px solid/);
    assert.doesNotMatch(CSS, /@media print|<script|!important[^;]*color/);
});
test('frozen native form and inherited include/save ownership are explicit', () => {
    const bytes = original().toString();
    assert.match(bytes, /\$formid = \(int\) \(\$_GET\['id'\] \?\? 0\);/);
    assert.match(bytes, /formFetch\("form_clinical_instructions", \$formid\)/);
    assert.match(bytes, /CsrfUtils::collectCsrfToken\(session: \$session\)/);
    assert.match(bytes, /save\.php\?id=<\?php echo attr_url\(\$formid\); \?>/);
    assert.match(bytes, /name="instruction" id="instruction"/);
    assert.match(bytes, /text\(\$check_res\['instruction'\] \?\? ''\)/);
    assert.match(bytes, /top\.restoreSession\(\)/);
    assert.match(bytes, /parent\.closeTab\(window\.name, false\)/);
    assert.equal(read(viewPath).toString().includes('require("new.php");'), true);
    const save = read(savePath).toString();
    assert.match(save, /CsrfUtils::checkCsrfInput\(INPUT_POST, dieOnFail: true\)/);
    assert.match(save, /EncounterFormAccess::assertFormBelongsToSessionPatient\(\$id, 'clinical_instructions'\)/);
    assert.match(save, /UPDATE form_clinical_instructions SET instruction =\? WHERE id = \?/);
});
test('synthetic exact additions pass whole-byte inverse before route edit', () => {
    const bytes = original();
    verifySource(proposed(bytes), bytes);
});
test('semantic, scope, geometry, palette, focus and print mutations are rejected', () => {
    const bytes = original();
    const candidate = proposed(bytes).toString();
    const fieldsetBlock = `  html.oe-workbench-context body.oe-clinical-instructions-editor fieldset {
    min-width: 0;
    margin-block: 0 1rem;
    padding: 0;
    border: 0;
    background-color: #fff !important;
    color: #182c36 !important;
  }`;
    once(Buffer.from(candidate), Buffer.from(fieldsetBlock), 'paired fieldset mutation anchor');
    const mutations = [
        ['formFetch("form_clinical_instructions", $formid)', 'formFetch("other", $formid)'],
        ['CsrfUtils::collectCsrfToken(session: $session)', 'CsrfUtils::otherToken(session: $session)'],
        ['attr_url($formid)', 'text($formid)'],
        ['name="instruction" id="instruction"', 'name="other" id="instruction"'],
        ["text($check_res['instruction'] ?? '')", "attr($check_res['instruction'] ?? '')"],
        ['top.restoreSession()', 'void 0'],
        ['parent.closeTab(window.name, false)', 'void 0'],
        ['@media screen {', '@media print {'],
        ['html.oe-workbench-context body.oe-clinical-instructions-editor', 'html body.oe-clinical-instructions-editor'],
        ['max-width: 860px;', 'max-width: 1200px;'],
        ['width: calc(100% - 2rem);', 'width: 50%;'],
        ['fieldset > .container {', 'fieldset > .other {'],
        [fieldsetBlock, fieldsetBlock.replace('background-color: #fff !important;', 'background-color: #fff;')],
        [fieldsetBlock, fieldsetBlock.replace('color: #182c36 !important;', 'color: #182c36;')],
        [fieldsetBlock, fieldsetBlock.replace('    background-color: #fff !important;\n', '')],
        [fieldsetBlock, fieldsetBlock.replace('    color: #182c36 !important;\n', '')],
        ['min-height: 12rem;', 'min-height: 2rem;'],
        ['flex-wrap: wrap;', 'flex-wrap: nowrap;'],
        ['background-color: #fff;', 'background-color: transparent;'],
        ['outline: 2px solid #216a91;', 'outline: 0;'],
        ['</style>', '@media print { body { display: none; } }\n</style>'],
        ['</body>', '<div>unexpected</div>\n</body>']
    ];
    for (const [before, after] of mutations) {
        assert.ok(candidate.includes(before), `negative anchor present: ${before}`);
        assert.throws(() => verifySource(Buffer.from(candidate.replace(before, after)), bytes), `reject ${before}`);
    }
    assert.throws(() => verifySource(bytes, bytes), 'untouched route lacks additions');
});
test('current route has only the exact additions', () => {
    const bytes = original();
    const current = read(sourcePath);
    assert.notDeepEqual(current, bytes, 'missing presentation additions');
    verifySource(current, bytes);
});
if (history) test('Git base, unchanged include/save and all changed paths bind to history', () => {
    git('merge-base', '--is-ancestor', BASE, 'HEAD');
    assert.deepEqual(original(), git('show', `${BASE}:${sourcePath}`), 'fixture equals base blob');
    for (const file of [viewPath, savePath]) {
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

module.exports = { CSS, additions, proposed, verifySource, sourcePath };
