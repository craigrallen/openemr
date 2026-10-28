'use strict';

// Portable contract: node --test-reporter=tap tests/clinical-ui/treatment-plan-editor-contract.cjs --history
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const sourcePath = 'interface/forms/treatment_plan/new.php';
const fixturePath = 'tests/clinical-ui/fixtures/treatment-plan-new-original.php.txt';
const savePath = 'interface/forms/treatment_plan/save.php';
const viewPath = 'interface/forms/treatment_plan/view.php';
const BASELINE = '09b29da7771aea334ed5745e058751157af980d7';
const ORIGINAL_SHA256 = 'adc08f05ff00234c1b9a85232382b0fe91edac83c79027c653f09a4885059906';
const SAVE_SHA256 = '760f886a4d020bf9300a4bc8a36ee7f0fa80ce8771e111703000b27b26fcc49f';
const VIEW_SHA256 = '367664aafdf21bc6fbab56c20f1a48f8d4dc2cb5d6ec7fc70e14044b2a198945';
const allowed = new Set([
    sourcePath,
    fixturePath,
    'tests/clinical-ui/treatment-plan-editor-contract.cjs',
    'tests/js/treatment-plan-editor.test.js',
    'docs/clinical-ui/TREATMENT-PLAN-EDITOR.md'
]);
const HEAD = '</head>';
const BODY = '<body class="body_top">';
const NEW_BODY = '<body class="body_top oe-treatment-plan-editor">';

// formHeader() has already emitted html/head/body. HTML parsing repairs the later
// duplicate tags: the style is parsed in the body and the second body tag's
// class is merged onto the open body. This does not repair the legacy source.
const CSS = `<style>
@media screen {
  html.oe-workbench-context body.oe-treatment-plan-editor {
    box-sizing: border-box;
    width: min(100% - 2rem, 860px);
    min-height: 100vh;
    margin-block: 1.5rem;
    margin-inline: auto;
    padding-block: 2rem;
    padding-inline: 36px;
    border: 1px solid #cbd6da;
    border-radius: 7px;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context {
    background-color: #edf2f3;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor > p {
    margin-block: 0 1.5rem;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor .forms-title {
    color: #182c36 !important;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form,
  html.oe-workbench-context body.oe-treatment-plan-editor form > table {
    width: 100%;
    max-width: none;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table {
    border-collapse: collapse;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(-n + 3) {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr) 120px minmax(0, 1fr);
    gap: 0.5rem 0.75rem;
    align-items: center;
    margin-block: 0 0.75rem;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(-n + 3) > td {
    box-sizing: border-box;
    min-width: 0;
    width: auto;
    padding: 0;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(4),
  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(12),
  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(13) {
    display: none;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:last-child {
    display: block;
    margin-block: 0.5rem 0;
    padding-block: 1rem 0;
    border-top: 1px solid #cbd6da;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:last-child > td:last-child {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(n + 5):nth-child(-n + 11) {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;
    margin-block: 0 1.5rem;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(n + 5):nth-child(-n + 11) > td {
    display: block;
    box-sizing: border-box;
    min-width: 0;
    width: 100%;
    padding: 0;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(n + 5):nth-child(-n + 11) > td:first-child {
    color: #182c36 !important;
    font-weight: 600;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form textarea {
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

  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='text'],
  html.oe-workbench-context body.oe-treatment-plan-editor form select {
    box-sizing: border-box;
    max-width: 100%;
    min-height: 2.5rem;
    padding-block: 0.35rem;
    padding-inline: 0.5rem;
    border: 1px solid #a9bbc3;
    border-radius: 4px;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form select[name='provider'] {
    width: 100% !important;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='submit'],
  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='button'] {
    min-height: 2.5rem;
    padding-block: 0.5rem;
    padding-inline: 1rem;
    border: 1px solid #536773 !important;
    border-radius: 4px;
    background-color: #fff !important;
    color: #182c36 !important;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='submit'] {
    border-color: #145968 !important;
    background-color: #145968 !important;
    color: #fff !important;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='submit']:hover,
  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='submit']:focus,
  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='submit']:active {
    border-color: #0d414d !important;
    background-color: #0d414d !important;
    color: #fff !important;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='button']:hover,
  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='button']:focus,
  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='button']:active {
    border-color: #182c36 !important;
    background-color: #e4f0f1 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='submit']:disabled {
    border-color: #536773 !important;
    background-color: #536773 !important;
    color: #fff !important;
    opacity: 1;
    cursor: default;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='button']:disabled {
    border-color: #536773 !important;
    background-color: #fff !important;
    color: #536773 !important;
    opacity: 1;
    cursor: default;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form textarea:focus-visible,
  html.oe-workbench-context body.oe-treatment-plan-editor form input:focus-visible,
  html.oe-workbench-context body.oe-treatment-plan-editor form select:focus-visible {
    outline: 2px solid #216a91;
    outline-offset: 2px;
  }
}

@media screen and (width <= 600px) {
  html.oe-workbench-context body.oe-treatment-plan-editor {
    width: calc(100% - 1rem);
    margin-block: 0.5rem;
    padding-inline: 1rem;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(-n + 3) {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>`;

const read = (relative) => fs.readFileSync(path.join(root, relative));
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
function once(value, anchor, label) {
    assert.ok(anchor.length, `${label}: nonempty anchor`);
    assert.notEqual(value.indexOf(anchor), -1, `${label}: present`);
    assert.equal(value.indexOf(anchor), value.lastIndexOf(anchor), `${label}: unique`);
}
function original() {
    const bytes = read(fixturePath);
    assert.equal(bytes.length, 7417, 'complete original byte count');
    assert.equal(hash(bytes), ORIGINAL_SHA256, 'complete original SHA-256');
    return bytes;
}
function proposed(bytes) {
    const source = bytes.toString('utf8');
    once(source, HEAD, 'head seam');
    once(source, BODY, 'body seam');
    return Buffer.from(source.replace(HEAD, `${CSS}\n${HEAD}`).replace(BODY, NEW_BODY));
}
function verifySource(bytes, baseline) {
    const source = bytes.toString('utf8');
    const style = `${CSS}\n${HEAD}`;
    once(source, style, 'exact style insertion');
    once(source, NEW_BODY, 'exact body class');
    assert.deepEqual(Buffer.from(source.replace(style, HEAD).replace(NEW_BODY, BODY)), baseline,
        'inverse restores every original byte, including PHP, scripts and malformed markup');
}
function checkScope(paths) {
    for (const file of paths) assert.ok(allowed.has(file), `out-of-scope changed path: ${file}`);
}
function gitBytes(...args) {
    return execFileSync('git', args, { cwd: root });
}
function gitPaths(...args) {
    return gitBytes(...args).toString('utf8').split('\n').filter(Boolean);
}

const args = process.argv.slice(2);
assert.ok(args.length <= 1 && (args.length === 0 || args[0] === '--history'), 'unknown or duplicate option');
const history = args.length === 1;

test('fixed proposal gives 860px paper and seven full-paper narrative fields', () => {
    assert.match(CSS, /^<style>\n@media screen \{/);
    assert.match(CSS, /width: min\(100% - 2rem, 860px\);/);
    assert.match(CSS, /padding-inline: 36px;/);
    assert.match(CSS, /tr:nth-child\(n \+ 5\):nth-child\(-n \+ 11\) \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/);
    assert.match(CSS, /form textarea \{[\s\S]*?width: 100%;[\s\S]*?min-height: 12rem;[\s\S]*?line-height: 1\.7;[\s\S]*?resize: vertical;/);
    assert.match(CSS, /select\[name='provider'\] \{\n    width: 100% !important;/);
    assert.match(CSS, /tr:last-child > td:last-child \{[\s\S]*?flex-wrap: wrap;/);
    assert.match(CSS, /@media screen and \(width <= 600px\) \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/);
    assert.doesNotMatch(CSS, /@media print|<script|@import/);
});
test('paper, fields and native actions have paired theme-safe palettes and focus', () => {
    for (const selector of ['body.oe-treatment-plan-editor {', '.forms-title {', 'form textarea {', "form input[type='text'],", "form input[type='submit'],", "form input[type='submit'] {", "form input[type='submit']:active {", "form input[type='button']:active {", "form input[type='submit']:disabled {", "form input[type='button']:disabled {"]) {
        const block = CSS.split(selector)[1]?.split('\n  }')[0];
        assert.ok(block, `palette rule: ${selector}`);
        assert.match(block, /color: #[0-9a-f]+ !important;/);
        if (!selector.includes('forms-title')) assert.match(block, /background-color: #[0-9a-f]+ !important;/);
    }
    for (const kind of ['submit', 'button']) {
        assert.match(CSS, new RegExp(`input\\[type='${kind}'\\]:hover,`));
        assert.match(CSS, new RegExp(`input\\[type='${kind}'\\]:focus,`));
        assert.match(CSS, new RegExp(`input\\[type='${kind}'\\]:active \\{`));
        assert.match(CSS, new RegExp(`input\\[type='${kind}'\\]:disabled \\{`));
    }
    assert.match(CSS, /form select:focus-visible \{\n    outline: 2px solid #216a91;/);
});
test('frozen form has the original fields, data flow and native actions', () => {
    const bytes = original().toString('utf8');
    const api = read('library/api.inc.php').toString('utf8');
    assert.match(api, /function formHeader\([\s\S]*?<html>[\s\S]*?<head>[\s\S]*?<\/head>[\s\S]*?<body background=/);
    assert.match(api, /function formFooter\([\s\S]*?<\/body>[\s\S]*?<\/html>/);
    assert.match(bytes, /<html><head>[\s\S]*?<\/head>\s*<body class="body_top">/);
    assert.match(bytes, /formHeader\("Form:Treatment Planning"\)/);
    assert.match(bytes, /formFetch\("form_treatment_plan", \$formid\)/);
    assert.match(bytes, /CsrfUtils::collectCsrfToken\(session: \$session\)/);
    assert.match(bytes, /save\.php\?id=/);
    for (const name of ['presenting_issues', 'patient_history', 'medications', 'anyother_relevant_information', 'diagnosis', 'treatment_received', 'recommendation_for_follow_up']) {
        assert.match(bytes, new RegExp(`<textarea name="${name}"`));
        assert.match(bytes, new RegExp(`text\\(\\$obj\\["${name}"\\]\\)`));
    }
    for (const name of ['client_name', 'DOB', 'client_number', 'admit_date', 'provider']) assert.match(bytes, new RegExp(`name=['"]${name}['"]`));
    assert.match(bytes, /type='submit'  value='<\?php echo xla\('Save'\)/);
    assert.match(bytes, /type='button' value='<\?php echo xla\('Print'\)/);
    assert.match(bytes, /type='button' class="button-css" value='<\?php echo xla\('Cancel'\)/);
    assert.match(bytes, /parent\.closeTab\(window\.name, false\)/);
    assert.match(bytes, /printLogSetup\(document\.getElementById\('printbutton'\)\)/);
    assert.match(bytes, /class="forms" class="forms"/);
    assert.match(bytes, /style='width:60%'/);
});
test('synthetic proposal passes its whole-byte inverse', () => {
    const bytes = original();
    verifySource(proposed(bytes), bytes);
});
test('semantic, geometry, context and action mutants are rejected independently', () => {
    const bytes = original();
    const candidate = proposed(bytes).toString('utf8');
    const mutations = [
        ['CsrfUtils::collectCsrfToken(session: $session)', 'CsrfUtils::otherToken(session: $session)'],
        ['name="presenting_issues"', 'name="other_issues"'],
        ['text($obj["diagnosis"])', 'attr($obj["diagnosis"])'],
        ['parent.closeTab(window.name, false)', 'void 0'],
        ['@media screen {', '@media print {'],
        ['html.oe-workbench-context body.oe-treatment-plan-editor {\n    box-sizing: border-box;', 'html body.oe-treatment-plan-editor {\n    box-sizing: border-box;'],
        ['width: min(100% - 2rem, 860px);', 'width: min(100% - 2rem, 1200px);'],
        ['padding-inline: 36px;', 'padding-inline: 80px;'],
        ['min-height: 12rem;', 'min-height: 2rem;'],
        ['line-height: 1.7;', 'line-height: 1;'],
        ['resize: vertical;', 'resize: none;'],
        ["form select[name='provider'] {\n    width: 100% !important;", "form select[name='provider'] {\n    width: 60%;"],
        ['flex-wrap: wrap;', 'flex-wrap: nowrap;'],
        ["form input[type='submit']:hover,", "form input[type='submit'].disabled,"],
        ["form input[type='button']:focus,", "form input[type='button'].disabled,"],
        ["form input[type='submit']:disabled {", "form input[type='submit'].disabled {"],
        ['outline: 2px solid #216a91;', 'outline: 0;'],
        ['</style>', '@media print { body { display: none; } }\n</style>'],
        ['</form>', '<div>unexpected</div>\n</form>']
    ];
    for (const [before, after] of mutations) {
        once(candidate, before, 'negative mutation anchor');
        assert.throws(() => verifySource(Buffer.from(candidate.replace(before, after)), bytes), `reject ${before}`);
    }
    assert.throws(() => verifySource(bytes, bytes), 'unchanged source lacks additions');
});
test('actual source has exactly the proposed presentation additions', () => {
    const bytes = original();
    const current = read(sourcePath);
    assert.notEqual(hash(current), hash(bytes), 'genuine RED until implementation');
    verifySource(current, bytes);
});
if (history) test('baseline fixture, unchanged support files and actual five-path boundary', () => {
    const bytes = original();
    assert.equal(Buffer.compare(gitBytes('show', `${BASELINE}:${sourcePath}`), bytes), 0,
        'fixture equals immutable baseline source bytes');
    assert.equal(hash(read(savePath)), SAVE_SHA256, 'save.php unchanged');
    assert.equal(hash(read(viewPath)), VIEW_SHA256, 'view.php unchanged');
    checkScope([
        ...gitPaths('diff', '--name-only', BASELINE),
        ...gitPaths('ls-files', '--others', '--exclude-standard')
    ]);
    for (const outside of [savePath, viewPath, 'interface/forms/soap/new.php']) {
        assert.throws(() => checkScope([outside]), /out-of-scope/);
    }
});

module.exports = { original, proposed, CSS, verifySource, sourcePath, checkScope };
