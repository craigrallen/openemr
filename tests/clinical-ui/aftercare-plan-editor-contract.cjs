'use strict';

// Portable contract: node --test --test-reporter=tap tests/clinical-ui/aftercare-plan-editor-contract.cjs
// History contract: node tests/clinical-ui/aftercare-plan-editor-contract.cjs --history
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const sourcePath = 'interface/forms/aftercare_plan/new.php';
const fixturePath = 'tests/clinical-ui/fixtures/aftercare-plan-new-original.php.txt';
const savePath = 'interface/forms/aftercare_plan/save.php';
const viewPath = 'interface/forms/aftercare_plan/view.php';
const ORIGINAL_SHA256 = '1ec81f59a42fa5132cbdc81125596089086f3ca5163f5af13c249b33b796d3d3';
const HEAD = '</head>';
const BODY = '<body class="body_top">';
const CSS = `<style>
@media screen {
  html.oe-workbench-context body.body_top.oe-aftercare-plan-editor {
    margin: 0;
    background-color: #edf2f3 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor > p,
  html.oe-workbench-context body.oe-aftercare-plan-editor > br,
  html.oe-workbench-context body.oe-aftercare-plan-editor > form {
    box-sizing: border-box;
    width: calc(100% - 2rem);
    max-width: 860px;
    margin-inline: auto;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor > p {
    margin-block: 1.5rem 0;
    padding-block: 1.5rem 0;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-bottom: 0;
    border-radius: 7px 7px 0 0;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor .forms-title {
    color: #182c36 !important;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor > br {
    display: none;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor > form {
    margin-block: 0 1.5rem;
    padding-block: 0 2rem;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-top: 0;
    border-radius: 0 0 7px 7px;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form > table {
    display: block;
    box-sizing: border-box;
    width: 100%;
    border-collapse: collapse;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form > table > tbody,
  html.oe-workbench-context body.oe-aftercare-plan-editor form > table tr {
    display: block;
    box-sizing: border-box;
    width: 100%;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(textarea) {
    display: block;
    width: 100%;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form td {
    padding-block: 0.4rem;
    padding-inline: 0.3rem;
    vertical-align: top;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form td:has(> textarea) {
    display: block;
    box-sizing: border-box;
    width: 100%;
    padding-inline: 0;
    padding-bottom: 1.25rem;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(textarea) > td {
    display: block;
    box-sizing: border-box;
    width: 100%;
    padding-inline: 0;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(.forms-data),
  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(input.datepicker) {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form td.forms-subtitle {
    display: block;
    box-sizing: border-box;
    width: 100%;
    padding-block: 1.2rem 0.6rem;
    border-bottom: 1px solid #cbd6da;
    background-color: #fff !important;
    color: #182c36 !important;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.5;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(.forms-data) > td,
  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(input.datepicker) > td {
    display: block;
    box-sizing: border-box;
    flex: 0 1 auto;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(textarea) > td:first-child {
    text-align: left;
    white-space: nowrap;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form .forms-data {
    background-color: #fff !important;
    color: #182c36 !important;
    line-height: 1.5;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form input.datepicker {
    box-sizing: border-box;
    width: min(100%, 11rem);
    min-height: 2.5rem;
    padding-block: 0.45rem;
    padding-inline: 0.65rem;
    border: 1px solid #a9bbc3;
    border-radius: 4px;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(input.button-css) {
    display: block;
    width: 100%;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(input.button-css) > td:first-child {
    display: none;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(input.button-css) > td:last-child {
    display: flex;
    box-sizing: border-box;
    width: 100%;
    padding-inline: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form textarea {
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

  html.oe-workbench-context body.oe-aftercare-plan-editor form input.button-css {
    display: inline-block;
    box-sizing: border-box;
    width: auto;
    max-width: 100%;
    min-height: 2.5rem;
    margin-block: 0.3rem;
    margin-inline: 0.2rem;
    padding-block: 0.55rem;
    padding-inline: 0.85rem;
    border: 1px solid #536773 !important;
    border-radius: 4px;
    background-color: #fff !important;
    color: #182c36 !important;
    cursor: pointer;
    font: inherit;
    font-weight: 600;
    white-space: normal;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form textarea:focus,
  html.oe-workbench-context body.oe-aftercare-plan-editor form textarea:focus-visible,
  html.oe-workbench-context body.oe-aftercare-plan-editor form input.datepicker:focus,
  html.oe-workbench-context body.oe-aftercare-plan-editor form input.datepicker:focus-visible,
  html.oe-workbench-context body.oe-aftercare-plan-editor form input.button-css:focus,
  html.oe-workbench-context body.oe-aftercare-plan-editor form input.button-css:focus-visible {
    outline: 2px solid #216a91;
    outline-offset: 2px;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form input.button-css:hover,
  html.oe-workbench-context body.oe-aftercare-plan-editor form input.button-css:focus,
  html.oe-workbench-context body.oe-aftercare-plan-editor form input.button-css:active {
    border-color: #182c36 !important;
    background-color: #e4f0f1 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form input.button-css:disabled {
    border-color: #a9bbc3 !important;
    background-color: #e8edef !important;
    color: #536773 !important;
    cursor: not-allowed;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form input[type='submit'].button-css {
    border-color: #145968 !important;
    background-color: #145968 !important;
    color: #fff !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form input[type='submit'].button-css:hover,
  html.oe-workbench-context body.oe-aftercare-plan-editor form input[type='submit'].button-css:focus,
  html.oe-workbench-context body.oe-aftercare-plan-editor form input[type='submit'].button-css:active {
    border-color: #0d414d !important;
    background-color: #0d414d !important;
    color: #fff !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form input[type='submit'].button-css:disabled {
    border-color: #a9bbc3 !important;
    background-color: #e8edef !important;
    color: #536773 !important;
  }

}

@media screen and (width <= 600px) {
  html.oe-workbench-context body.oe-aftercare-plan-editor form > table,
  html.oe-workbench-context body.oe-aftercare-plan-editor form > table > tbody,
  html.oe-workbench-context body.oe-aftercare-plan-editor form > table tr,
  html.oe-workbench-context body.oe-aftercare-plan-editor form > table td {
    display: block;
    box-sizing: border-box;
    width: 100%;
  }

}
</style>`;

const read = (relative) => fs.readFileSync(path.join(root, relative));
const git = (...args) => execFileSync('git', args, { cwd: root });
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
function once(bytes, anchor, label) {
    assert.ok(anchor.length, `${label}: nonempty anchor`);
    assert.notEqual(bytes.indexOf(anchor), -1, `${label}: present`);
    assert.equal(bytes.indexOf(anchor), bytes.lastIndexOf(anchor), `${label}: unique`);
}
function ruleBlock(css, selector, required = '') {
    const anchor = `\n  html.oe-workbench-context body.oe-aftercare-plan-editor ${selector} {\n`;
    const matches = css.split(anchor).slice(1).map((part) => part.split('\n  }')[0])
        .filter((block) => block.includes(required));
    assert.equal(matches.length, 1, `unique CSS rule ${selector} containing ${required}`);
    return matches[0];
}
function verifyGeometry(css) {
    assert.match(ruleBlock(css, '> form', 'max-width'), /max-width: 860px;/);
    assert.match(ruleBlock(css, '> form', 'margin-block'), /padding-inline: clamp\(1rem, 4vw, 2\.25rem\);/);
    assert.match(ruleBlock(css, 'form > table'), /display: block;\n    box-sizing: border-box;\n    width: 100%;/);
    assert.match(ruleBlock(css, 'form > table tr'), /display: block;\n    box-sizing: border-box;\n    width: 100%;/);
    assert.match(ruleBlock(css, 'form tr:has(input.datepicker)'), /display: flex;\n    flex-wrap: wrap;/);
    assert.match(ruleBlock(css, 'form tr:has(textarea)'), /display: block;\n    width: 100%;/);
    const narrativeCells = ruleBlock(css, 'form td:has(> textarea)', 'display: block');
    assert.match(narrativeCells, /display: block;\n    box-sizing: border-box;\n    width: 100%;\n    padding-inline: 0;/);
    const narrativeRowCells = ruleBlock(css, 'form tr:has(textarea) > td');
    assert.match(narrativeRowCells, /display: block;\n    box-sizing: border-box;\n    width: 100%;\n    padding-inline: 0;/);
    assert.match(ruleBlock(css, 'form tr:has(textarea) > td:first-child'), /text-align: left;\n    white-space: nowrap;/);
    assert.match(ruleBlock(css, 'form textarea'), /display: block;[\s\S]*?box-sizing: border-box;[\s\S]*?width: 100%;/);
    assert.match(ruleBlock(css, 'form tr:has(input.button-css)'), /display: block;\n    width: 100%;/);
    assert.match(ruleBlock(css, 'form tr:has(input.button-css) > td:last-child'), /display: flex;\n    box-sizing: border-box;\n    width: 100%;\n    padding-inline: 0;\n    flex-wrap: wrap;/);
    // At a wide viewport, the 860px form has 2 * 36px padding and 2px border.
    const paperWidth = Number(ruleBlock(css, '> form', 'max-width').match(/max-width: (\d+)px;/)[1]);
    const paperPadding = Number(ruleBlock(css, '> form', 'margin-block').match(/padding-inline: clamp\(1rem, 4vw, ([\d.]+)rem\);/)[1]) * 16;
    assert.equal(paperWidth - 2 * paperPadding - 2, 786);
}
const additions = [[HEAD, `${CSS}\n${HEAD}`], [BODY, '<body class="body_top oe-aftercare-plan-editor">']];
function original() {
    const bytes = read(fixturePath);
    assert.equal(bytes.length, 7156, 'complete original byte count');
    assert.equal(hash(bytes), ORIGINAL_SHA256, 'complete original SHA-256');
    return bytes;
}
function proposed(bytes) {
    let source = bytes.toString('utf8');
    for (const [before, after] of additions) {
        once(Buffer.from(source), Buffer.from(before), 'original seam');
        source = source.replace(before, after);
    }
    return Buffer.from(source);
}
function verifySource(bytes, baseline) {
    let source = bytes.toString('utf8');
    for (const [before, after] of additions) {
        once(Buffer.from(source), Buffer.from(after), 'exact addition');
        source = source.replace(after, before);
    }
    assert.deepEqual(Buffer.from(source), baseline, 'whole original byte sequence preserved');
}
function checkScope(files) {
    const allowed = new Set([sourcePath, fixturePath,
        'tests/clinical-ui/aftercare-plan-editor-contract.cjs', 'tests/js/aftercare-plan-editor.test.js']);
    for (const file of files) assert.ok(allowed.has(file), `out-of-scope changed path: ${file}`);
}
const args = process.argv.slice(2);
assert.ok(args.every((arg) => arg === '--history'), 'unknown option');
assert.ok(args.length <= 1, 'duplicate --history');

test('four-path boundary rejects save, view, docs and unrelated changes', () => {
    assert.throws(() => checkScope([sourcePath, savePath]), /out-of-scope/);
    assert.throws(() => checkScope([viewPath]), /out-of-scope/);
    assert.throws(() => checkScope(['docs/clinical-ui/PLAN.md']), /out-of-scope/);
    assert.throws(() => checkScope(['docs/clinical-ui/AFTERCARE-PLAN-EDITOR.md']), /out-of-scope/);
});
test('header emits the context and legacy roots need browser repair', () => {
    const header = read('src/Core/Header.php').toString();
    const api = read('library/api.inc.php').toString();
    const source = original().toString();
    assert.match(header, /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(read('interface/clinical-workspace/popup.js').toString(), /const CONTEXT_CLASS = 'oe-workbench-context'/);
    assert.match(api, /function formHeader[\s\S]*?<html>[\s\S]*?<head>[\s\S]*?<\/head>[\s\S]*?<body background=/);
    assert.match(api, /function formFooter[\s\S]*?<\/body>[\s\S]*?<\/html>/);
    assert.match(source, /formHeader\("Form:AfterCare Planning"\);[\s\S]*?<html>\s*<head>/);
    assert.match(source, /<\/head>\s*<body class="body_top">/);
    assert.match(source, /<td align="left colspan="3"/);
    assert.match(source, /<\/tr>\s*<td class="forms-subtitle" colspan="4">/);
    // The HTML parser keeps one document root/body, copies the later body class,
    // and repairs missing table rows. Runtime browser confirmation remains separate.
    assert.doesNotMatch(CSS, /nth-child|nth-of-type/);
    assert.match(CSS, /tr:has\(textarea\)/);
    assert.match(CSS, /td:has\(> textarea\)/);
});
test('fixed CSS gives paper-relative narrative fields and readable metadata', () => {
    assert.match(CSS, /^<style>\n@media screen \{/);
    assert.match(CSS, /html\.oe-workbench-context body\.oe-aftercare-plan-editor/);
    assert.match(CSS, /max-width: 860px;/);
    assert.match(CSS, /padding-inline: clamp\(1rem, 4vw, 2\.25rem\);/);
    const cellRuleOrder = [
        'form td {',
        'form td:has(> textarea) {',
        'form tr:has(textarea) > td {',
        'form td.forms-subtitle {',
        'form tr:has(.forms-data) > td,',
        'form tr:has(textarea) > td:first-child {'
    ];
    let previousRule = -1;
    for (const selector of cellRuleOrder) {
        const position = CSS.indexOf(`  html.oe-workbench-context body.oe-aftercare-plan-editor ${selector}`);
        assert.ok(position > previousRule, `${selector} follows lower-specificity cell rules`);
        previousRule = position;
    }
    verifyGeometry(CSS);
    assert.match(CSS, /form textarea \{[\s\S]*?width: 100%;[\s\S]*?min-height: 12rem;[\s\S]*?line-height: 1\.7;[\s\S]*?resize: vertical;/);
    for (const selector of ['> p {', '> form {', 'form > table {', 'form td {', 'form td.forms-subtitle {', 'form .forms-data {', 'form input.datepicker {']) {
        const block = ruleBlock(CSS, selector.slice(0, -2), selector === '> form {' ? 'margin-block' : '');
        assert.match(block, /background-color: #[0-9a-f]+ !important;/);
        assert.match(block, /color: #[0-9a-f]+ !important;/);
    }
    assert.match(CSS, /@media screen and \(width <= 600px\) \{/);
    assert.doesNotMatch(CSS, /@media print|<script|@import/);
});
test('native inputs retain paired palettes in every action state', () => {
    for (const selector of ['form input.button-css {', 'form input.button-css:active {', 'form input.button-css:disabled {', "form input[type='submit'].button-css {", "form input[type='submit'].button-css:active {", "form input[type='submit'].button-css:disabled {"]) {
        const block = ruleBlock(CSS, selector.slice(0, -2));
        for (const property of ['border-color', 'background-color', 'color']) {
            const declaration = property === 'border-color' && selector === 'form input.button-css {'
                ? /border: 1px solid #[0-9a-f]+ !important;/
                : new RegExp(`${property}: #[0-9a-f]+ !important;`);
            assert.match(block, declaration);
        }
    }
    assert.match(CSS, /input\.button-css:hover,/);
    assert.match(CSS, /input\.button-css:focus,/);
    assert.match(CSS, /input\.button-css:focus-visible \{\n    outline: 2px solid #216a91;/);
});
test('frozen source retains values, seven fields, two dates and native actions', () => {
    const source = original().toString();
    assert.match(source, /formFetch\("form_aftercare_plan", \$formid\)/);
    assert.match(source, /CsrfUtils::collectCsrfToken\(session: \$session\)/);
    assert.match(source, /forms\/aftercare_plan\/save\.php\?id=/);
    assert.equal((source.match(/<textarea name="goal_/g) || []).length, 7);
    assert.equal((source.match(/class='datepicker' name='/g) || []).length, 2);
    for (const field of ['goal_a_acute_intoxication', 'goal_a_acute_intoxication_I', 'goal_a_acute_intoxication_II', 'goal_b_emotional_behavioral_conditions', 'goal_b_emotional_behavioral_conditions_I', 'goal_c_relapse_potential', 'goal_c_relapse_potential_I']) {
        assert.ok(source.includes(`name="${field}"`), field);
        assert.ok(source.includes(`text($obj["${field}"])`), field);
    }
    for (const label of ['Goal A', 'Goal B', 'Goal C', 'Admit Date', 'Discharged']) assert.ok(source.includes(label), label);
    assert.match(source, /type='submit' value='<\?php echo xla\('Save'\)/);
    assert.match(source, /value='<\?php echo xla\('Print'\); \?>' id='printbutton'/);
    assert.match(source, /parent\.closeTab\(window\.name, false\)/);
    assert.match(read(savePath).toString(), /CsrfUtils::checkCsrfInput\(INPUT_POST, dieOnFail: true\)/);
    assert.match(read(viewPath).toString(), /require\("new\.php"\)/);
});
test('synthetic exact proposal passes whole-byte inverse', () => {
    const bytes = original();
    verifySource(proposed(bytes), bytes);
});
test('paper-width geometry rejects presentation mutants before implementation', () => {
    const bytes = original();
    const narrativeRowCellRule = `  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(textarea) > td {
    display: block;
    box-sizing: border-box;
    width: 100%;
    padding-inline: 0;
  }`;
    const mutations = [
        ['form > table {\n    display: block;', 'form > table {\n    display: table;'],
        ['form tr:has(input.datepicker) {\n    display: flex;', 'form tr:has(input.datepicker) {\n    display: table-row;'],
        ['form tr:has(textarea) {\n    display: block;', 'form tr:has(textarea) {\n    display: table-row;'],
        ['form td:has(> textarea) {\n    display: block;\n    box-sizing: border-box;\n    width: 100%;', 'form td:has(> textarea) {\n    display: block;\n    box-sizing: border-box;\n    width: 50%;'],
        [narrativeRowCellRule, narrativeRowCellRule.replace('padding-inline: 0;', 'padding-inline: 0.3rem;')],
        ['form tr:has(input.button-css) {\n    display: block;', 'form tr:has(input.button-css) {\n    display: table-row;']
    ];
    for (const [before, after] of mutations) {
        once(Buffer.from(CSS), Buffer.from(before), `geometry mutant ${before}`);
        const mutant = CSS.replace(before, after);
        assert.throws(() => verifyGeometry(mutant), `geometry rejects ${before}`);
        const candidate = proposed(bytes).toString().replace(before, after);
        assert.throws(() => verifySource(Buffer.from(candidate), bytes), `inverse rejects ${before}`);
    }
});
test('semantic and presentation mutants fail the whole-byte inverse', () => {
    const bytes = original();
    const candidate = proposed(bytes).toString();
    const mutations = [
        ['formFetch("form_aftercare_plan", $formid)', 'formFetch("other", $formid)'],
        ['CsrfUtils::collectCsrfToken(session: $session)', 'CsrfUtils::otherToken(session: $session)'],
        ['name="goal_c_relapse_potential_I"', 'name="other"'],
        ['text($obj["goal_a_acute_intoxication"])', 'attr($obj["goal_a_acute_intoxication"])'],
        ['parent.closeTab(window.name, false)', 'void 0'],
        ['@media screen {', '@media print {'],
        ['max-width: 860px;', 'max-width: 1200px;'],
        ['form tr:has(textarea) {\n    display: block;', 'form tr:has(textarea) {\n    display: table-row;'],
        ['min-height: 12rem;', 'min-height: 2rem;'],
        ['line-height: 1.7;', 'line-height: 1;'],
        ['resize: vertical;', 'resize: none;'],
        ['background-color: #145968 !important;', 'background-color: transparent;'],
        ['cursor: not-allowed;', 'cursor: pointer;'],
        ['<body class="body_top oe-aftercare-plan-editor">', '<body class="oe-aftercare-plan-editor">'],
        ['</form>', '<div>unexpected</div></form>']
    ];
    for (const [before, after] of mutations) {
        once(Buffer.from(candidate), Buffer.from(before), `negative anchor ${before}`);
        assert.throws(() => verifySource(Buffer.from(candidate.replace(before, after)), bytes), `reject ${before}`);
    }
    assert.throws(() => verifySource(bytes, bytes), 'untouched route lacks additions');
});
test('actual route has exact presentation additions', () => {
    const bytes = original();
    assert.notDeepEqual(read(sourcePath), bytes, 'expected genuine RED until implementation');
    verifySource(read(sourcePath), bytes);
});
if (args.includes('--history')) test('base blobs, unchanged save/view and full changed-path scope', () => {
    git('merge-base', '--is-ancestor', BASE, 'HEAD');
    assert.deepEqual(original(), git('show', `${BASE}:${sourcePath}`), 'fixture equals base blob');
    for (const file of [savePath, viewPath]) assert.deepEqual(read(file), git('show', `${BASE}:${file}`), `${file} remains at base`);
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
