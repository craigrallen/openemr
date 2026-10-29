'use strict';

// Source contract for the fee sheet code chooser. The fixture is the complete
// original CSS; removing the single proposed block must restore every byte.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const CSS = 'interface/forms/fee_sheet/code_choice/css/code_choices.css';
const FIXTURE = 'tests/clinical-ui/fixtures/fee-code-choices-original.css.txt';
const CONTRACT = 'tests/clinical-ui/fee-code-choice-contract.cjs';
const ADAPTER = 'tests/js/fee-code-choice.test.js';
const DOC = 'docs/clinical-ui/FEE-CODE-CHOICE.md';
const SCOPE = Object.freeze([CSS, FIXTURE, CONTRACT, ADAPTER, DOC]);
const SUPPORTING = Object.freeze({
    'interface/forms/fee_sheet/code_choice/templates/code_choices.php': '5eb190d480858349db346b482f08bbee4783a43923c18c369585a82dd53e2c7c',
    'interface/forms/fee_sheet/code_choice/js/view_model.js': '53ec65db0ce929f82541e167f6efc9feb8664c7161648176d8f5b4b336bc58cf',
    'interface/forms/fee_sheet/code_choice/initialize_code_choice.php': '82f6f89595ae249c4bd2739d36e0ed0539f604f3e229f83fc5f1a3f2094f8144',
    'interface/forms/fee_sheet/new.php': 'f419fe70b745742a863f64627c433fd1dbead7e912c34162dc9be042a7183260',
    'interface/clinical-workspace/popup.css': 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9'
});
const read = (name) => fs.readFileSync(path.join(ROOT, name));
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const original = () => read(FIXTURE).toString('utf8');
const S = 'html.oe-workbench-context div.code-choices';

// Every selector in the only appended screen block starts at the surviving
// Knockout root. The native button colours, checkbox and warning hover stay native.
const RULES = Object.freeze([
    `${S} button:focus,\n  ${S} input[type='checkbox']:focus {\n    outline: 3px solid #086878;\n    outline-offset: 2px;\n  }`,
    `${S} {\n    box-sizing: border-box;\n    width: min(100%, 1000px);\n    min-width: 0;\n    margin: 20px auto;\n    padding: 20px 24px;\n    color: #17343b;\n    background-color: #fff;\n    border: 1px solid #d9e4e2;\n  }`,
    `${S} > div[data-bind='foreach:categories'] {\n    display: grid;\n    grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));\n    gap: 12px;\n    min-width: 0;\n  }`,
    `${S} div.category-display {\n    float: none;\n    width: auto;\n    min-width: 0;\n    margin: 0;\n  }`,
    `${S} div.category-display > button {\n    box-sizing: border-box;\n    width: 100%;\n    max-width: 100%;\n    margin: 0;\n    white-space: normal;\n    overflow-wrap: break-word;\n  }`,
    `${S} .active-category {\n    box-sizing: border-box;\n    position: relative;\n    width: 100%;\n    min-width: 0;\n    margin-top: 20px;\n    padding: 20px;\n    color: #17343b;\n    background-color: #fff;\n    border: 1px solid #d9e4e2;\n  }`,
    `${S} .active-category [data-bind='foreach:codes'] {\n    display: grid;\n    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));\n    gap: 12px;\n    min-width: 0;\n  }`,
    `${S} div.code-choice {\n    display: flex;\n    align-items: flex-start;\n    gap: 8px;\n    float: none;\n    width: auto;\n    min-width: 0;\n  }`,
    `${S} div.code-choice > span {\n    min-width: 0;\n    overflow-wrap: break-word;\n  }`
]);
const STYLE = `\n@media screen {\n  ${RULES.join('\n\n  ')}\n}\n`;

function proposedCandidate() {
    return original() + STYLE;
}

function assertCandidate(source) {
    assert.equal(typeof source, 'string');
    assert.equal(source, proposedCandidate(), 'only the frozen scoped screen block may follow the full original CSS');
    const restored = source.slice(0, -STYLE.length);
    assert.deepEqual(Buffer.from(restored), read(FIXTURE), 'inverse must restore the complete original fixture');
    return restored;
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
    assert.equal(git('merge-base', base, 'HEAD').trim(), base, 'HEAD must descend from the bound base');
    assert.equal(git('show', `${base}:${CSS}`), original(), 'fixture differs from the base Git blob');
    const changed = git('diff', '--name-only', base, '--').trim().split('\n').filter(Boolean);
    const untracked = git('ls-files', '--others', '--exclude-standard').trim().split('\n').filter(Boolean);
    for (const file of [...changed, ...untracked]) {
        assert.ok(SCOPE.includes(file), `out-of-scope path: ${file}`);
    }
}

module.exports = { CSS, SCOPE, SUPPORTING, RULES, STYLE, original, proposedCandidate,
    assertCandidate, assertSupportingUnchanged, assertHistory };

if (require.main === module) {
    const test = require('node:test');
    test('the fixture contains the full 1082-byte original stylesheet', () => {
        assert.equal(read(FIXTURE).length, 1082);
    });
    test('the proposed block reverses exactly to the original', () => {
        assert.equal(assertCandidate(proposedCandidate()), original());
    });
    if (!process.argv.includes('--candidate')) {
        test('the shipped stylesheet satisfies the proposed contract', () => {
            assertCandidate(read(CSS).toString('utf8'));
        });
    }
    test('native template, handlers, loader, caller and popup framing retain their source', assertSupportingUnchanged);
    test('the native DOM and selection behavior anchors are present', () => {
        const template = read('interface/forms/fee_sheet/code_choice/templates/code_choices.php').toString('utf8');
        const model = read('interface/forms/fee_sheet/code_choice/js/view_model.js').toString('utf8');
        assert.match(template, /data-bind="foreach:categories"/);
        assert.match(template, /class='active-category' data-bind='visible: show_choices'/);
        assert.match(template, /data-bind="foreach:codes"/);
        assert.match(template, /event: \{mouseup: toggle_code\}/);
        assert.match(template, /checked: selected, click: toggle_code/);
        assert.match(model, /template\.addClass\("code-choices"\)/);
        assert.match(model, /elem\.before\(template\)/);
        assert.match(model, /function codes_cancel[\s\S]*?show_choices\(false\)/);
    });
    test('missing rules, unscoped or print styling, absolute panel and fixed button width fail', () => {
        const candidate = proposedCandidate();
        const mutants = RULES.map((rule) => candidate.replace(rule, ''));
        mutants.push(candidate.replace('html.oe-workbench-context div.code-choices', 'div.code-choices'));
        mutants.push(candidate.replace('@media screen', '@media print'));
        mutants.push(candidate.replace('position: relative;\n    width: 100%', 'position: absolute;\n    width: 100%'));
        mutants.push(candidate.replace('width: 100%;\n    max-width: 100%', 'width: 25em;\n    max-width: 100%'));
        mutants.push(candidate.replace("data-bind='foreach:codes'", "data-bind='foreach:categories'"));
        for (const mutant of mutants) {
            assert.notEqual(mutant, candidate, 'each mutant must change the proposed CSS');
            assert.throws(() => assertCandidate(mutant));
        }
    });
    if (process.argv.includes('--history')) {
        test('the base blob and committed, working and untracked scope remain bound', assertHistory);
    }
}
