'use strict';

// node --test --test-reporter=tap tests/clinical-ui/transfer-summary-editor-contract.cjs
// node tests/clinical-ui/transfer-summary-editor-contract.cjs --history
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const sourcePath = 'interface/forms/transfer_summary/new.php';
const fixturePath = 'tests/clinical-ui/fixtures/transfer-summary-new-original.php.txt';
const savePath = 'interface/forms/transfer_summary/save.php';
const viewPath = 'interface/forms/transfer_summary/view.php';
const originalHash = '37ff3bee9d58d41826da8a0cbec986fe243f4558affb9e521e49cd09263400e7';
const saveHash = 'c75b401a3dc58a3489df426059c78840cb804abc981a623d25dec960caf5bd0d';
const viewHash = 'b0e43406d01a9fde99d5003e0ec98c2e7ce789b5a501f19b29fb6c7b4f4bd3a9';
const head = '</head>';
const body = '<body class="body_top">';
const revisedBody = '<body class="body_top oe-transfer-summary-editor">';
const CSS = `<style>
@media screen {
  html.oe-workbench-context body.body_top.oe-transfer-summary-editor {
    margin: 0;
    background-color: #edf2f3 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor > p,
  html.oe-workbench-context body.oe-transfer-summary-editor > br,
  html.oe-workbench-context body.oe-transfer-summary-editor > form {
    box-sizing: border-box;
    width: calc(100% - 2rem);
    max-width: 860px;
    margin-inline: auto;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor > p {
    margin-block: 1.5rem 0;
    padding-block: 1.5rem 0;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-bottom: 0;
    border-radius: 7px 7px 0 0;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor .forms-title {
    color: #182c36 !important;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor > br {
    display: none;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor > form {
    margin-block: 0 1.5rem;
    padding-block: 0 2rem;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-top: 0;
    border-radius: 0 0 7px 7px;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form > table {
    display: block;
    box-sizing: border-box;
    width: 100%;
    border-collapse: collapse;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form > table > tbody,
  html.oe-workbench-context body.oe-transfer-summary-editor form > table tr {
    display: block;
    box-sizing: border-box;
    width: 100%;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form td {
    padding-block: 0.4rem;
    padding-inline: 0.3rem;
    vertical-align: top;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form .forms-data {
    background-color: #fff !important;
    color: #182c36 !important;
    line-height: 1.5;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form input#transfer_to,
  html.oe-workbench-context body.oe-transfer-summary-editor form input#transfer_date {
    box-sizing: border-box;
    max-width: 100%;
    min-height: 2.5rem;
    padding-block: 0.45rem;
    padding-inline: 0.65rem;
    border: 1px solid #a9bbc3;
    border-radius: 4px;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form input#transfer_to {
    width: min(100%, 20rem);
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form input#transfer_date {
    width: min(100%, 11rem);
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(> td > textarea) {
    display: block;
    width: 100%;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(> td > textarea) > td {
    display: block;
    box-sizing: border-box;
    width: 100%;
    padding-inline: 0;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(> td > textarea) > td:first-child {
    padding-block: 1rem 0.4rem;
    text-align: left;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.5;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(> td > textarea) > td:last-child {
    padding-block: 0 1rem;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(.forms-data),
  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(#transfer_to) {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 0.5rem;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(.forms-data) > td,
  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(#transfer_to) > td {
    display: block;
    box-sizing: border-box;
    flex: 0 1 auto;
    min-width: 0;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form textarea {
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

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(#printbutton) {
    display: block;
    width: 100%;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(#printbutton) > td:first-child {
    display: none;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(#printbutton) > td:last-child {
    display: flex;
    box-sizing: border-box;
    width: 100%;
    padding-inline: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form input[type='submit'],
  html.oe-workbench-context body.oe-transfer-summary-editor form input#printbutton,
  html.oe-workbench-context body.oe-transfer-summary-editor form input.button-css[type='button'] {
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

  html.oe-workbench-context body.oe-transfer-summary-editor form input[type='submit'] {
    border-color: #145968 !important;
    background-color: #145968 !important;
    color: #fff !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form input[type='submit']:hover,
  html.oe-workbench-context body.oe-transfer-summary-editor form input[type='submit']:focus,
  html.oe-workbench-context body.oe-transfer-summary-editor form input[type='submit']:active {
    border-color: #0d414d !important;
    background-color: #0d414d !important;
    color: #fff !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form input#printbutton:hover,
  html.oe-workbench-context body.oe-transfer-summary-editor form input#printbutton:focus,
  html.oe-workbench-context body.oe-transfer-summary-editor form input#printbutton:active,
  html.oe-workbench-context body.oe-transfer-summary-editor form input.button-css[type='button']:hover,
  html.oe-workbench-context body.oe-transfer-summary-editor form input.button-css[type='button']:focus,
  html.oe-workbench-context body.oe-transfer-summary-editor form input.button-css[type='button']:active {
    border-color: #182c36 !important;
    background-color: #e4f0f1 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form input[type='submit']:disabled,
  html.oe-workbench-context body.oe-transfer-summary-editor form input#printbutton:disabled,
  html.oe-workbench-context body.oe-transfer-summary-editor form input.button-css[type='button']:disabled {
    border-color: #a9bbc3 !important;
    background-color: #e8edef !important;
    color: #536773 !important;
    cursor: not-allowed;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form textarea:focus-visible,
  html.oe-workbench-context body.oe-transfer-summary-editor form input#transfer_to:focus-visible,
  html.oe-workbench-context body.oe-transfer-summary-editor form input#transfer_date:focus-visible,
  html.oe-workbench-context body.oe-transfer-summary-editor form input[type='submit']:focus-visible,
  html.oe-workbench-context body.oe-transfer-summary-editor form input#printbutton:focus-visible,
  html.oe-workbench-context body.oe-transfer-summary-editor form input.button-css[type='button']:focus-visible {
    outline: 2px solid #216a91;
    outline-offset: 2px;
  }
}

@media screen and (width <= 600px) {
  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(.forms-data) > td,
  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(#transfer_to) > td {
    flex-basis: 100%;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form input#transfer_to,
  html.oe-workbench-context body.oe-transfer-summary-editor form input#transfer_date {
    width: 100%;
  }
}
</style>`;

const read = (relative) => fs.readFileSync(path.join(root, relative));
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root });
function once(bytes, anchor, label) {
    assert.ok(anchor.length, `${label}: nonempty anchor`);
    assert.notEqual(bytes.indexOf(anchor), -1, `${label}: present`);
    assert.equal(bytes.indexOf(anchor), bytes.lastIndexOf(anchor), `${label}: unique`);
}
function original() {
    const bytes = read(fixturePath);
    assert.equal(bytes.length, 5993, 'original byte count');
    assert.equal(hash(bytes), originalHash, 'original SHA-256');
    return bytes;
}
function proposed(bytes) {
    let source = bytes.toString('utf8');
    once(Buffer.from(source), Buffer.from(head), 'head seam');
    once(Buffer.from(source), Buffer.from(body), 'body seam');
    source = source.replace(head, `${CSS}\n${head}`);
    source = source.replace(body, revisedBody);
    return Buffer.from(source);
}
function verifySource(bytes, baseline = original()) {
    assert.deepEqual(baseline, original(), 'baseline is the frozen original');
    let source = bytes.toString('utf8');
    const inserted = `${CSS}\n${head}`;
    once(Buffer.from(source), Buffer.from(inserted), 'style before original head close');
    once(Buffer.from(source), Buffer.from(revisedBody), 'body class addition');
    source = source.replace(inserted, head).replace(revisedBody, body);
    assert.deepEqual(Buffer.from(source), baseline, 'exact whole-source inverse');
}
function rule(css, selector) {
    const marker = `  html.oe-workbench-context body.oe-transfer-summary-editor ${selector} {\n`;
    const blocks = css.split(marker).slice(1).map((part) => part.split('\n  }')[0]);
    assert.equal(blocks.length, 1, `one rule for ${selector}`);
    return blocks[0];
}
function groupedRules(css, selector) {
    const marker = `  html.oe-workbench-context body.oe-transfer-summary-editor ${selector}`;
    const lines = css.split('\n');
    const blocks = lines.flatMap((line, index) => {
        if (line !== `${marker},` && line !== `${marker} {`) return [];
        const tail = lines.slice(index).join('\n');
        const open = tail.indexOf(' {\n');
        return [tail.slice(open + 3, tail.indexOf('\n  }', open))];
    });
    assert.ok(blocks.length > 0, `CSS includes ${selector}`);
    return blocks;
}
function pair(block) {
    assert.match(block, /background-color: #[0-9a-f]+ !important;/);
    assert.match(block, /color: #[0-9a-f]+ !important;/);
    const background = block.match(/background-color: (#[0-9a-f]+) !important;/)[1];
    const foreground = block.match(/(?:^|\n)    color: (#[0-9a-f]+) !important;/)[1];
    const luminance = (hex) => {
        const channels = hex.length === 4
            ? [...hex.slice(1)].map((digit) => parseInt(digit + digit, 16))
            : [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
        return channels.map((channel) => {
            const value = channel / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    };
    const values = [luminance(background), luminance(foreground)].sort((a, b) => b - a);
    assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, `${foreground} on ${background} contrast`);
}
function checkScope(files) {
    const allowed = new Set([sourcePath, fixturePath,
        'tests/clinical-ui/transfer-summary-editor-contract.cjs',
        'tests/js/transfer-summary-editor.test.js',
        'docs/clinical-ui/TRANSFER-SUMMARY-EDITOR.md']);
    for (const file of files) assert.ok(allowed.has(file), `out-of-scope changed path: ${file}`);
}
const args = process.argv.slice(2);
assert.deepEqual(args, args.length ? ['--history'] : [], 'unknown or repeated option');

test('original bytes, fields and native workflows are frozen', () => {
    const source = original().toString('utf8');
    assert.match(source, /formFetch\("form_transfer_summary", \$formid\)/);
    assert.match(source, /CsrfUtils::collectCsrfToken\(session: \$session\)/);
    assert.match(source, /forms\/transfer_summary\/save\.php\?id=/);
    assert.match(source, /name="client_name"/);
    assert.match(source, /name="DOB"/);
    assert.match(source, /name="transfer_to" id="transfer_to"/);
    assert.match(source, /name='transfer_date' id='transfer_date'/);
    for (const field of ['status_of_admission', 'diagnosis', 'intervention_provided', 'overall_status_of_discharge']) {
        assert.ok(source.includes(`<textarea name="${field}"`), field);
        assert.ok(source.includes(`text($obj["${field}"] ?? '')`), field);
    }
    assert.equal((source.match(/<textarea name=/g) || []).length, 4);
    for (const label of ['Status Of Admission', 'Diagnosis', 'Intervention Provided', 'Overall Status Of Discharge']) {
        assert.ok(source.includes(label), label);
    }
    assert.match(source, /type='submit'\s+value='<\?php echo xlt\('Save'\)/);
    assert.match(source, /<input type='button' value='<\?php echo xla\('Print'\); \?>' id='printbutton' \/>/);
    assert.doesNotMatch(source, /id='printbutton'\s+class=/);
    assert.match(source, /parent\.closeTab\(window\.name, false\)/);
    assert.match(read(savePath).toString(), /CsrfUtils::checkCsrfInput\(INPUT_POST, dieOnFail: true\)/);
    assert.match(read(viewPath).toString(), /require\("new\.php"\)/);
});

test('browser-repaired document and malformed legacy markup remain in source', () => {
    const api = read('library/api.inc.php').toString();
    const source = original().toString();
    assert.match(api, /function formHeader[\s\S]*?<html>[\s\S]*?<head>[\s\S]*?<\/head>[\s\S]*?<body background=/);
    assert.match(api, /function formFooter[\s\S]*?<\/body>[\s\S]*?<\/html>/);
    assert.match(source, /formHeader\("Form:Transfer Summary"\);[\s\S]*?<html>\s*<head>/);
    assert.match(source, /<\/head>\s*<body class="body_top">/);
    assert.match(source, /<td align="left colspan="3"/);
    assert.match(source, /wrap="virtual name"/);
    assert.match(read('interface/clinical-workspace/popup.js').toString(), /CONTEXT_CLASS = 'oe-workbench-context'/);
    assert.doesNotMatch(CSS, /nth-child|nth-of-type/);
});

test('fixed screen CSS gives full paper-relative narratives and readable metadata', () => {
    assert.match(CSS, /^<style>\n@media screen \{/);
    assert.doesNotMatch(CSS, /@media print|<script|@import|:root|html:has/);
    const formRules = groupedRules(CSS, '> form');
    assert.equal(formRules.length, 2, 'shared paper geometry and form surface');
    assert.match(formRules[0], /width: calc\(100% - 2rem\);\n    max-width: 860px;\n    margin-inline: auto;/);
    assert.match(formRules[1], /padding-inline: clamp\(1rem, 4vw, 2\.25rem\);/);
    assert.match(rule(CSS, 'form > table'), /display: block;[\s\S]*width: 100%;/);
    assert.match(rule(CSS, 'form > table tr'), /display: block;[\s\S]*width: 100%;/);
    assert.match(rule(CSS, 'form tr:has(> td > textarea)'), /display: block;\n    width: 100%;/);
    assert.match(rule(CSS, 'form tr:has(> td > textarea) > td'), /display: block;\n    box-sizing: border-box;\n    width: 100%;\n    padding-inline: 0;/);
    assert.match(rule(CSS, 'form textarea'), /width: 100%;[\s\S]*min-height: 12rem;[\s\S]*line-height: 1\.7;[\s\S]*resize: vertical;/);
    assert.match(groupedRules(CSS, 'form tr:has(.forms-data)')[0], /display: flex;\n    flex-wrap: wrap;/);
    assert.match(groupedRules(CSS, 'form tr:has(#transfer_to)')[0], /display: flex;\n    flex-wrap: wrap;/);
    assert.match(rule(CSS, 'form tr:has(> td > textarea) > td:first-child'), /font-weight: 700;\n    line-height: 1\.5;/);
    assert.match(rule(CSS, 'form input#transfer_to'), /width: min\(100%, 20rem\);/);
    assert.ok(groupedRules(CSS, 'form input#transfer_date').some((block) => /width: min\(100%, 11rem\);/.test(block)));
    for (const selector of ['> p', 'form > table', 'form td', 'form .forms-data', 'form textarea']) pair(rule(CSS, selector));
    pair(formRules[1]);
    const narrow = CSS.slice(CSS.indexOf('@media screen and (width <= 600px)'));
    assert.match(narrow, /^@media screen and \(width <= 600px\)/);
    for (const selector of ['form tr:has(.forms-data) > td', 'form tr:has(#transfer_to) > td']) {
        assert.ok(groupedRules(narrow, selector).some((block) => /flex-basis: 100%;/.test(block)));
    }
    for (const selector of ['form input#transfer_to', 'form input#transfer_date']) {
        assert.ok(groupedRules(narrow, selector).some((block) => /width: 100%;/.test(block)));
    }
    assert.equal(860 - 2 * 2.25 * 16 - 2, 786, 'paper inner width at desktop');
});

test('Save, Print and Cancel have paired normal, interaction and disabled palettes', () => {
    for (const action of ["form input[type='submit']", 'form input#printbutton', "form input.button-css[type='button']"]) {
        for (const state of ['', ':hover', ':focus', ':active', ':disabled']) {
            for (const block of groupedRules(CSS, `${action}${state}`)) pair(block);
        }
        assert.ok(groupedRules(CSS, `${action}:focus-visible`).some((block) => block.includes('outline: 2px solid #216a91;')));
    }
    assert.match(rule(CSS, 'form tr:has(#printbutton) > td:last-child'), /display: flex;[\s\S]*width: 100%;[\s\S]*flex-wrap: wrap;/);
    assert.match(CSS, /cursor: not-allowed;/);
    assert.match(CSS, /outline: 2px solid #216a91;/);
});

test('synthetic proposal passes exact whole-source inverse', () => {
    const bytes = original();
    verifySource(proposed(bytes), bytes);
});

test('anchored semantic and presentation mutants fail', () => {
    const bytes = original();
    const candidate = proposed(bytes).toString();
    const mutants = [
        ['formFetch("form_transfer_summary", $formid)', 'formFetch("other", $formid)'],
        ['CsrfUtils::collectCsrfToken(session: $session)', 'CsrfUtils::otherToken(session: $session)'],
        ['name="overall_status_of_discharge"', 'name="other"'],
        ['text($obj["diagnosis"] ?? \'\')', 'attr($obj["diagnosis"] ?? \'\')'],
        ['parent.closeTab(window.name, false)', 'void 0'],
        ['@media screen {', '@media print {'],
        ['max-width: 860px;', 'max-width: 1200px;'],
        ['min-height: 12rem;', 'min-height: 2rem;'],
        ['line-height: 1.7;', 'line-height: 1;'],
        ['resize: vertical;', 'resize: none;'],
        ['background-color: #145968 !important;', 'background-color: transparent;'],
        ['cursor: not-allowed;', 'cursor: pointer;'],
        [revisedBody, '<body class="oe-transfer-summary-editor">'],
        ['</form>', '<div>unexpected</div></form>']
    ];
    for (const [before, after] of mutants) {
        once(Buffer.from(candidate), Buffer.from(before), `negative anchor ${before}`);
        assert.throws(() => verifySource(Buffer.from(candidate.replace(before, after)), bytes), `reject ${before}`);
    }
    assert.throws(() => verifySource(bytes, bytes), 'unmodified source is RED');
});

test('five-path publication boundary rejects unrelated files', () => {
    checkScope([sourcePath, fixturePath, 'tests/clinical-ui/transfer-summary-editor-contract.cjs',
        'tests/js/transfer-summary-editor.test.js', 'docs/clinical-ui/TRANSFER-SUMMARY-EDITOR.md']);
    for (const file of [savePath, viewPath, 'docs/clinical-ui/PLAN.md']) {
        assert.throws(() => checkScope([file]), /out-of-scope/);
    }
});

test('actual route has the exact presentation insertion', () => {
    const bytes = original();
    assert.notDeepEqual(read(sourcePath), bytes, 'genuine RED before product edit');
    verifySource(read(sourcePath), bytes);
});

if (args.includes('--history')) test('fixture, supporting files and changed paths match publication scope', () => {
    original();
    assert.equal(hash(read(savePath)), saveHash, 'save.php remains unchanged');
    assert.equal(hash(read(viewPath)), viewHash, 'view.php remains unchanged');
    const changed = [
        ...git('diff', '--name-only', '-z', '--no-renames', 'HEAD', '--').toString().split('\0'),
        ...git('ls-files', '--others', '--exclude-standard', '-z').toString().split('\0')
    ].filter(Boolean);
    checkScope(changed);
    for (const file of changed) {
        const absolute = path.join(root, file);
        if (fs.existsSync(absolute)) assert.ok(!fs.lstatSync(absolute).isSymbolicLink(), `symlink: ${file}`);
    }
});

module.exports = { CSS, original, proposed, verifySource, sourcePath };
