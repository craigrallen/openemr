'use strict';

// Portable source contract. The fixture is inert text; this module never executes PHP.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const ORIGINAL_PATH = 'tests/clinical-ui/fixtures/patient-notes-body-original.php.txt';
const ROUTE_PATH = 'interface/patient_file/summary/pnotes_full.php';
const TEST_PATH = 'tests/clinical-ui/patient-notes-body-contract.cjs';
const ADAPTER_PATH = 'tests/js/patient-notes-body.test.js';
const DOC_PATH = 'docs/clinical-ui/PATIENT-NOTES-BODY.md';
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const SCOPE = [ROUTE_PATH, ORIGINAL_PATH, TEST_PATH, ADAPTER_PATH, DOC_PATH];
const ALLOWED = new Set(SCOPE);
const ANCHOR = '    <script src="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/mode.js?v=<?php echo attr_url($clinicalAssets->version(\'mode.js\')); ?>" defer></script>';
const STYLE = `    <style>
@media screen {
  body.oe-clinical-workspace.oe-clinical-messages #pnotes h3 {
    overflow-wrap: anywhere;
  }

  body.oe-clinical-workspace.oe-clinical-messages #pnotes h3 span {
    display: block;
    margin-top: 6px;
    font-size: 18px;
    line-height: 1.4;
    letter-spacing: normal;
    overflow-wrap: anywhere;
  }

  body.oe-clinical-workspace.oe-clinical-messages #pnotes .row > .row {
    flex: 0 0 100%;
    max-width: 100%;
    min-width: 0;
  }

  body.oe-clinical-workspace.oe-clinical-messages #pnotes .row > .row > .col-12 {
    min-width: 0;
  }

  body.oe-clinical-workspace.oe-clinical-messages #pnotes .btn-group > .btn {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 100%;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  body.oe-clinical-workspace.oe-clinical-messages #pnotes .tabContainer.jumbotron.p-4 {
    padding: clamp(12px, 2vw, 28px) !important;
  }

  body.oe-clinical-workspace.oe-clinical-messages #pnotes .tabContainer th {
    overflow-wrap: anywhere;
    white-space: normal;
  }

  body.oe-clinical-workspace.oe-clinical-messages #pnotes .noterow > td:nth-child(5) {
    min-width: 38ch;
    max-width: 65ch;
    padding: 18px 22px;
    overflow-wrap: anywhere;
    line-height: 1.65;
  }
}
    </style>
`;

const count = (haystack, needle) => haystack.split(needle).length - 1;
const read = (relative) => fs.readFileSync(path.join(ROOT, relative));

function assertStyleShape(style) {
    assert.match(style, /^    <style>\n@media screen \{\n/);
    assert.match(style, /\n\}\n    <\/style>\n$/);
    assert.equal(count(style, '@media'), 1);
    const rules = [...style.matchAll(/^  ([^{}]+) \{\n((?:    [^\n]+\n)+)  \}$/gm)];
    assert.equal(rules.length, 8, 'eight route-scoped geometry rules');
    for (const [, selector, declarations] of rules) {
        assert.ok(selector.startsWith('body.oe-clinical-workspace.oe-clinical-messages #pnotes '), selector);
        assert.doesNotMatch(selector, /(?:^|\s)(?:table|tr|td)\s*$/);
        assert.doesNotMatch(declarations, /(?:color|background|font-family|position|visibility|overflow-x|overflow-y):/);
        if (selector === 'body.oe-clinical-workspace.oe-clinical-messages #pnotes h3 span') {
            assert.equal(count(declarations, 'font-size:'), 1, 'only one patient context font size');
            assert.equal(count(declarations, 'font-size: 18px;'), 1, 'patient context font size');
        } else {
            assert.doesNotMatch(declarations, /font-size:/);
        }
        assert.doesNotMatch(declarations, /(?:display:\s*(?:none|grid|flex)|overflow:\s*hidden)/);
        for (const line of declarations.trimEnd().split('\n')) {
            assert.match(line, /^    [a-z-]+: [^;]+;$/);
            if (line.includes('!important')) assert.match(line, /^    padding: /);
        }
    }
    const rule = (selector) => {
        const found = rules.find(([, name]) => name === `body.oe-clinical-workspace.oe-clinical-messages #pnotes ${selector}`);
        assert.ok(found, `missing ${selector}`);
        return found[2];
    };
    for (const value of ['display: block', 'font-size: 18px', 'line-height: 1.4', 'letter-spacing: normal', 'overflow-wrap: anywhere']) assert.ok(rule('h3 span').includes(value));
    assert.ok(rule('h3').includes('overflow-wrap: anywhere'));
    for (const value of ['flex: 0 0 100%', 'max-width: 100%', 'min-width: 0']) assert.ok(rule('.row > .row').includes(value));
    for (const value of ['flex: 0 1 auto', 'min-width: 0', 'max-width: 100%', 'overflow-wrap: anywhere', 'white-space: normal']) assert.ok(rule('.btn-group > .btn').includes(value));
    assert.ok(rule('.tabContainer.jumbotron.p-4').includes('padding: clamp(12px, 2vw, 28px) !important'));
    assert.ok(rule('.tabContainer th').includes('overflow-wrap: anywhere'));
    for (const value of ['min-width: 38ch', 'max-width: 65ch', 'padding: 18px 22px', 'overflow-wrap: anywhere', 'line-height: 1.65']) assert.ok(rule('.noterow > td:nth-child(5)').includes(value));
    assert.equal(style, STYLE, 'the proposed block is exact');
}

function insertStyle(original) {
    const bytes = Buffer.isBuffer(original) ? original : Buffer.from(original);
    const source = bytes.toString('utf8');
    assert.equal(count(source, ANCHOR), 1, 'one existing first script anchor');
    assert.equal(count(source.slice(0, source.indexOf(ANCHOR)), '<script'), 0, 'anchor is the first script');
    assert.match(source.slice(0, source.indexOf(ANCHOR)), /patient-messages\.css\?v=/);
    return Buffer.from(source.replace(ANCHOR, STYLE + ANCHOR));
}

function verifySource(candidate, original) {
    const candidateBytes = Buffer.isBuffer(candidate) ? candidate : Buffer.from(candidate);
    const originalBytes = Buffer.isBuffer(original) ? original : Buffer.from(original);
    const source = candidateBytes.toString('utf8');
    const before = originalBytes.toString('utf8');
    assert.equal(count(before, '<style'), 0, 'original has no inline style');
    assert.equal(count(source, '<style'), 1, 'one inline style only');
    assert.equal(count(source, STYLE), 1, 'exact style block once');
    assert.equal(count(source, ANCHOR), 1, 'original first script retained once');
    assertStyleShape(STYLE);
    const at = source.indexOf(STYLE);
    assert.equal(source.slice(at + STYLE.length, at + STYLE.length + ANCHOR.length), ANCHOR, 'style immediately before first script');
    assert.equal(count(source.slice(0, at), '<script'), 0, 'no earlier script');
    const inverse = Buffer.from(source.slice(0, at) + source.slice(at + STYLE.length));
    assert.deepEqual(inverse, originalBytes, 'entire original route must survive verbatim');
    return inverse;
}

function git(args) {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] });
}

function verifyChangedPaths(changedPaths) {
    const changes = new Set(changedPaths);
    assert.ok(changes.has(ORIGINAL_PATH) && changes.has(TEST_PATH) && changes.has(ADAPTER_PATH), 'all three test files must be in scope');
    for (const name of changes) assert.ok(ALLOWED.has(name), `out-of-scope change: ${name}`);
    return [...changes].sort();
}

function verifyHistory() {
    assert.equal(git(['rev-parse', '--show-toplevel']).toString().trim(), ROOT);
    assert.equal(git(['rev-parse', `${BASE}^{commit}`]).toString().trim(), BASE);
    const fixture = read(ORIGINAL_PATH);
    assert.deepEqual(fixture, git(['show', `${BASE}:${ROUTE_PATH}`]), 'fixture must equal the entire exact base blob');
    const changes = new Set();
    for (const args of [
        ['diff', '--name-only', '-z', '--no-renames', BASE, 'HEAD'],
        ['diff', '--name-only', '-z', '--no-renames'],
        ['diff', '--cached', '--name-only', '-z', '--no-renames'],
        ['ls-files', '--others', '--exclude-standard', '-z']
    ]) {
        for (const name of git(args).toString().split('\0').filter(Boolean)) changes.add(name);
    }
    return verifyChangedPaths(changes);
}

module.exports = { STYLE, ORIGINAL_PATH, ROUTE_PATH, BASE, insertStyle, verifySource, verifyChangedPaths, verifyHistory };

if (require.main === module || process.env.NODE_TEST_CONTEXT) {
    const test = require('node:test');
    const original = read(ORIGINAL_PATH);
    const positive = insertStyle(original);
    const mutate = (needle, replacement, expected = 1) => {
        assert.equal(count(positive.toString(), needle), expected, `mutant anchor: ${needle}`);
        assert.notEqual(needle, replacement);
        const changed = Buffer.from(positive.toString().replace(needle, replacement));
        assert.notDeepEqual(changed, positive, 'mutant changes source bytes');
        return changed;
    };
    const rejected = (name, needle, replacement, expected = 1) => test(name, () => {
        const mutant = mutate(needle, replacement, expected);
        assert.throws(() => verifySource(mutant, original));
    });

    test('positive synthetic candidate restores the complete fixture', () => {
        assert.deepEqual(verifySource(positive, original), original);
    });
    test('history scope accepts all five allowed paths', () => {
        assert.deepEqual(verifyChangedPaths(SCOPE), [...SCOPE].sort());
    });
    test('history scope rejects an unrelated path', () => {
        assert.throws(() => verifyChangedPaths([...SCOPE, 'unrelated.txt']), /out-of-scope change: unrelated\.txt/);
    });
    test('history scope requires each test path', () => {
        for (const required of [ORIGINAL_PATH, TEST_PATH, ADAPTER_PATH]) {
            assert.throws(() => verifyChangedPaths(SCOPE.filter((name) => name !== required)), /all three test files must be in scope/);
        }
    });
    rejected('SQL patient linkage stays exact', 'SELECT foreign_id FROM documents WHERE id = ?', 'SELECT foreign_id FROM documents WHERE id = 1');
    rejected('patient context stays exact', '$patient_id = intval($row[\'foreign_id\']);', '$patient_id = 0;');
    rejected('ACL stays exact', "AclMain::aclCheckCore('patients', 'notes', '', ['write','addonly'])", "AclMain::aclCheckCore('patients', 'notes')");
    rejected('CSRF stays exact', 'CsrfUtils::collectCsrfToken(session: $session)', 'CsrfUtils::collectCsrfToken()', 4);
    rejected('session stays exact', "$session->get('pid', 0)", "$session->get('pid', 1)");
    rejected('output escaping stays exact', 'pnoteConvertLinks(nl2br(text(oeFormatPatientNote($body))))', 'pnoteConvertLinks(nl2br($body))', 4);
    rejected('print JS stays exact', "window.open('pnotes_print.php?noteid=", "window.open('other.php?noteid=");
    rejected('controls stay exact', "class='deletenote btn btn-danger btn-sm btn-delete'", "class='deletenote btn btn-danger btn-sm removed'", 2);
    test('duplicate or moved style is rejected', () => {
        const duplicated = Buffer.from(positive.toString().replace(STYLE, STYLE + STYLE));
        assert.notDeepEqual(duplicated, positive);
        assert.throws(() => verifySource(duplicated, original));
        const moved = Buffer.from(positive.toString().replace(STYLE, '').replace('</head>', STYLE + '</head>'));
        assert.notDeepEqual(moved, positive);
        assert.throws(() => verifySource(moved, original));
    });
    rejected('additional style is rejected', ANCHOR, '<style>p { color: red; }</style>\n' + ANCHOR);
    rejected('unscoped selector is rejected', 'body.oe-clinical-workspace.oe-clinical-messages #pnotes h3 span', 'h3 span');
    rejected('screen media is required', '@media screen {', '@media all {');
    rejected('patient line geometry is required', 'letter-spacing: normal;', 'letter-spacing: 2px;');
    rejected('patient context font size is required', 'font-size: 18px;', 'font-size: 24px;');
    rejected('patient context line height is required', 'line-height: 1.4;', 'line-height: 1;');
    rejected('toolbar full width is required', 'flex: 0 0 100%;', 'flex: 0 0 50%;');
    rejected('button wrapping is required', 'white-space: normal;', 'white-space: nowrap;', 2);
    rejected('sheet padding is required', 'padding: clamp(12px, 2vw, 28px) !important;', 'padding: 24px !important;');
    rejected('message column geometry is required', 'min-width: 38ch;', 'min-width: 10ch;');
    rejected('native table semantics are required', 'line-height: 1.65;', 'display: grid;');
    test('live route accepts only the declared style insertion', () => {
        verifySource(read(ROUTE_PATH), original);
    });
    if (process.argv.includes('--history')) test('exact base fixture and five-path history scope', verifyHistory);
}
