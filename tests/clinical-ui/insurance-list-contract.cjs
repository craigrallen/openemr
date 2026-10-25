'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const fixturePath = path.join(__dirname, 'fixtures/insurance-list-original.php.txt');
const routePath = path.join(root, 'interface/practice/ins_list.php');
const original = fs.readFileSync(fixturePath);
const tableBefore = '<table class="table table-sm border-0 w-100">';
const tableAfter = '<table class="table table-sm border-0 w-100 oe-insurance-results">';
const styleBefore = 'td {\n    font-size: 0.8125rem;\n}\n</style>';
const css = `@media screen {
  html.oe-workbench-context table.oe-insurance-results {
    color: var(--oe-wb-ink, #17343b);
    background-color: var(--oe-wb-paper, #fff);
  }

  html.oe-workbench-context table.oe-insurance-results td {
    border-color: var(--oe-wb-line, #d9e4e2);
  }

  html.oe-workbench-context table.oe-insurance-results a {
    color: var(--oe-wb-petrol, #086878);
  }

  html.oe-workbench-context table.oe-insurance-results a:focus-visible {
    outline: 2px solid var(--oe-wb-petrol, #086878);
    outline-offset: 2px;
  }
}`;
const styleAfter = styleBefore.replace('</style>', `${css}\n</style>`);
const additions = Object.freeze([[tableBefore, tableAfter], [styleBefore, styleAfter]]);

function occurrences(haystack, needle) {
    return haystack.split(needle).length - 1;
}

function propose(source) {
    let value = source;
    for (const [before, after] of additions) {
        assert.equal(occurrences(value, before), 1, `unique original anchor: ${before}`);
        assert.equal(occurrences(value, after), 0, `proposed addition absent: ${after}`);
        value = value.replace(before, () => after);
    }
    return value;
}

function restore(source) {
    let value = source;
    for (const [before, after] of additions) {
        assert.equal(occurrences(value, after), 1, `unique required addition: ${after}`);
        value = value.replace(after, () => before);
    }
    return value;
}

function violations(source) {
    try {
        const restored = restore(source);
        return Buffer.from(restored).equals(original) ? [] : ['restored bytes differ from original route'];
    } catch (error) {
        return [error.message];
    }
}

function assertUniqueMutation(source, before, after) {
    assert.equal(occurrences(source, before), 1, `mutation anchor must exist exactly once: ${before}`);
    assert.notEqual(before, after);
    const mutated = source.replace(before, () => after);
    assert.notEqual(mutated, source);
    assert.notDeepEqual(violations(mutated), [], `oracle accepted mutation: ${before}`);
}

if (require.main === module) {
test('the exact original route accepts only the two additive presentation changes', () => {
    const proposed = propose(original.toString('utf8'));
    assert.equal(occurrences(proposed, 'oe-insurance-results'), 5);
    assert.deepEqual(violations(proposed), []);
    assert.deepEqual(Buffer.from(restore(proposed)), original);

    const sharedCss = fs.readFileSync(path.join(root, 'interface/clinical-workspace/popup.css'), 'utf8');
    for (const declaration of [
        '--oe-wb-ink: #17343b;',
        '--oe-wb-paper: #fff;',
        '--oe-wb-line: #d9e4e2;',
        '--oe-wb-petrol: #086878;',
    ]) {
        assert.ok(sharedCss.includes(declaration), `shared popup token: ${declaration}`);
    }
    assert.match(sharedCss, /html\.oe-workbench-context,\s*body\.workbench-active > \.dialogModal\s*\{/);

    const parent = fs.readFileSync(path.join(root, 'interface/practice/ins_search.php'), 'utf8');
    assert.ok(parent.includes('require(OEGlobalsBag::getInstance()->getSrcDir() . "/restoreSession.php");'));
    assert.ok(parent.includes("var search_list = 'ins_list.php?' + params;"));
    assert.ok(parent.includes('top.restoreSession();\n            $("#form_list").load(search_list).show();'));
});

test('inverse rejects SQL, CSRF, escaping, selection, opener, typography, geometry, print and scope mutations', () => {
    const proposed = propose(original.toString('utf8'));
    const mutations = [
        ["$query .= $where . \" ORDER BY i.name, a.zip\";", "$query .= $where . \" ORDER BY i.id\";"],
        ['CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);', 'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: false);'],
        ["attr_js($row['id'])", "$row['id']"],
        ["text($row['name'])", "$row['name']"],
        ["return setins(", "return chooseins("],
        ["if (!window.opener) {", "if (window.opener) {"],
        ["opener.postMessage(postMessage, window.location.origin);", "opener.postMessage(postMessage, '*');"],
        ['font-size: 0.8125rem;', 'font-size: 1rem;'],
        ['class="table table-sm border-0 w-100 oe-insurance-results"', 'class="table table-lg border-0 w-100 oe-insurance-results"'],
        ['@media screen {', '@media print {'],
        ['html.oe-workbench-context table.oe-insurance-results {', 'body.oe-workbench-context table.oe-insurance-results {'],
        ['outline-offset: 2px;', 'outline-offset: 4px;'],
        ['background-color: var(--oe-wb-paper, #fff);', 'background-color: #fff !important;'],
        ['<body class="body_top">', '<body class="body_top oe-insurance-results">'],
    ];
    for (const [before, after] of mutations) assertUniqueMutation(proposed, before, after);
});

test('the production route contains exactly the proposed additions and restores every original byte', () => {
    assert.deepEqual(violations(fs.readFileSync(routePath, 'utf8')), []);
});

if (process.argv.includes('--history')) {
    test('local base fixture and five-path change scope remain pinned', () => {
        const base = '09b29da7771aea334ed5745e058751157af980d7';
        const route = 'interface/practice/ins_list.php';
        const parent = 'interface/practice/ins_search.php';
        const cssAsset = 'interface/clinical-workspace/popup.css';
        const jsAsset = 'interface/clinical-workspace/popup.js';
        const documentation = 'docs/clinical-ui/INSURANCE-LIST.md';
        const contract = 'tests/clinical-ui/insurance-list-contract.cjs';
        const fixture = 'tests/clinical-ui/fixtures/insurance-list-original.php.txt';
        const adapter = 'tests/js/insurance-list.test.js';
        const allowed = new Set([route, contract, fixture, adapter, documentation]);
        const git = (...args) => execFileSync('git', args, { cwd: root });
        const names = (...args) => git(...args).toString('utf8').split('\0').filter(Boolean);
        assert.deepEqual(git('show', `${base}:${route}`), original);
        const changed = new Set([
            ...names('diff', '--name-only', '-z', base, 'HEAD'),
            ...names('diff', '--name-only', '-z', 'HEAD'),
            ...names('ls-files', '--others', '--exclude-standard', '-z'),
        ]);
        for (const file of changed) assert.ok(allowed.has(file), `unexpected change: ${file}`);
        for (const file of [parent, cssAsset, jsAsset]) {
            assert.deepEqual(fs.readFileSync(path.join(root, file)), git('show', `${base}:${file}`), `unchanged base bytes: ${file}`);
        }
    });
}
}

module.exports = { additions, propose, restore, violations };
