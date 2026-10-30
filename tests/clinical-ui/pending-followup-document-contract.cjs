// Portable static contract. It reads the route; it never executes PHP or writes a file.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const SOURCE = 'interface/orders/pending_followup.php';
const FIXTURE = 'tests/clinical-ui/fixtures/pending-followup-original.php.txt';
const HISTORY_REF = '09b29da7771aea334ed5745e058751157af980d7';
const SCOPE = 'html.oe-workbench-context body.oe-pending-followup-document';
const BODY_BEFORE = "<body leftmargin='0' topmargin='0' marginwidth='0' marginheight='0'>";
const BODY_AFTER = "<body class='oe-pending-followup-document' leftmargin='0' topmargin='0' marginwidth='0' marginheight='0'>";
const HEAD_END = '\n</head>';
const ADDED_STYLE = `
<style>
@media screen {
  ${SCOPE} > center {
    max-width: 1100px;
    width: calc(100% - 32px);
    margin: 16px auto;
    padding: clamp(12px, 2vw, 28px);
    border: 1px solid #d6e1e4;
    border-radius: 8px;
    background: #fff;
    color: #243c43;
    box-sizing: border-box;
  }

  ${SCOPE} > center > h2 {
    text-align: left;
    margin: 0 0 16px;
  }

  ${SCOPE} > center > form {
    max-width: 100%;
  }
}
</style>`;

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const count = (text, needle) => text.split(needle).length - 1;

function requireOnce(text, needle, label) {
    assert.equal(count(text, needle), 1, `${label} must occur exactly once`);
}

function insertPresentation(original) {
    requireOnce(original, BODY_BEFORE, 'original body seam');
    requireOnce(original, HEAD_END, 'original head seam');
    assert.equal(count(original, ADDED_STYLE), 0, 'fixture must not contain proposed style');
    return original.replace(BODY_BEFORE, BODY_AFTER)
        .replace(HEAD_END, `${ADDED_STYLE}${HEAD_END}`);
}

function verifyPresentation(source, original) {
    requireOnce(source, BODY_AFTER, 'document body class');
    requireOnce(source, ADDED_STYLE, 'screen style block');
    const restored = source.replace(BODY_AFTER, BODY_BEFORE)
        .replace(ADDED_STYLE, '');
    assert.equal(restored, original, 'the complete original route must survive unchanged');
    assert.equal(source, insertPresentation(original), 'presentation must use only the declared seams');

    const exportBranch = source.indexOf("if ($_POST['form_csvexport']) {");
    const htmlBranch = source.indexOf('} else { // not export');
    const htmlOpen = source.indexOf('<html>');
    const style = source.indexOf(ADDED_STYLE);
    const headEnd = source.indexOf('</head>');
    const body = source.indexOf(BODY_AFTER);
    const htmlClose = source.indexOf('</html>');
    const report = source.indexOf('} // end not export');
    assert.ok(exportBranch >= 0 && exportBranch < htmlBranch);
    assert.ok(htmlBranch < htmlOpen && htmlOpen < style && style < headEnd);
    assert.ok(headEnd < body && body < report && report < htmlClose);
    assert.equal(count(source, '<style>'), 1, 'only one route-local style block');
    assert.equal(count(source, BODY_BEFORE), 0, 'legacy body seam must be replaced');
}

function verifyStyle(style) {
    assert.match(style, /^\n<style>\n@media screen \{\n/);
    assert.match(style, /\n\}\n<\/style>$/);
    const rules = [...style.matchAll(/^  ([^{}\n]+) \{\n([^{}]+)^  \}$/gm)];
    assert.equal(rules.length, 3, 'exactly the center, heading, and form rules');
    for (const [, selector, declarations] of rules) {
        assert.ok(selector.startsWith(SCOPE), `unscoped selector: ${selector}`);
        assert.doesNotMatch(declarations, /(?:display|visibility|overflow|font(?:-family|-size|-weight)?|pointer-events|opacity)\s*:/i);
    }
    assert.doesNotMatch(style, /@media\s+print|!important|\b(?:table|thead|tbody|tr|td|th|input|select|button)\b/i);
    assert.match(style, /max-width: 1100px;/);
    assert.match(style, /width: calc\(100% - 32px\);/);
    assert.match(style, /margin: 16px auto;/);
    assert.match(style, /padding: clamp\(12px, 2vw, 28px\);/);
    assert.match(style, /border: 1px solid #d6e1e4;/);
    assert.match(style, /border-radius: 8px;/);
    assert.match(style, /background: #fff;/);
    assert.match(style, /color: #243c43;/);
    assert.match(style, /box-sizing: border-box;/);
    assert.match(style, /text-align: left;/);
    assert.match(style, /margin: 0 0 16px;/);
    assert.match(style, /max-width: 100%;/);
}

function rejectMutation(valid, original, label, before, after) {
    requireOnce(valid, before, `${label} mutation target`);
    const mutant = valid.replace(before, after);
    assert.notEqual(mutant, valid, `${label} mutation must change the source`);
    assert.throws(() => verifyPresentation(mutant, original), undefined, `${label} must fail`);
}

function git(args) {
    const run = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.ifError(run.error);
    assert.equal(run.status, 0, `git ${args[0]} failed: ${run.stderr}`);
    return run.stdout;
}

function verifyHistory(original) {
    assert.equal(git(['show', `${HISTORY_REF}:${SOURCE}`]), original,
        'fixture must equal the complete pinned source');
    const allowed = new Set([
        SOURCE,
        'tests/clinical-ui/pending-followup-document-contract.cjs',
        'tests/js/pending-followup-document.test.js',
        FIXTURE,
        'docs/clinical-ui/PENDING-FOLLOWUP-DOCUMENT.md',
    ]);
    const lists = [
        git(['diff', '--name-only', HISTORY_REF, 'HEAD']),
        git(['diff', '--name-only', 'HEAD']),
        git(['ls-files', '--others', '--exclude-standard']),
    ];
    for (const file of new Set(lists.flatMap((list) => list.split('\n').filter(Boolean)))) {
        assert.ok(allowed.has(file), `changed path outside five-file allowlist: ${file}`);
    }
}

const original = read(FIXTURE);
const source = read(SOURCE);

test('the native route has exactly the proposed HTML-only presentation', () => {
    verifyPresentation(source, original);
});

test('the untouched fixture genuinely fails the missing-presentation contract', () => {
    assert.throws(() => verifyPresentation(original, original), /document body class/);
    verifyPresentation(insertPresentation(original), original);
});

test('the proposed style is screen-only, scoped, and limited to document spacing', () => {
    verifyStyle(ADDED_STYLE);
});

test('the actual Header and workbench helper chain supports the context selector', () => {
    assert.match(original, /Header::setupHeader\(\['datetime-picker'\]\)/);
    assert.match(read('src/Core/Header.php'), /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(read('config/config.yaml'), /workbench-popup:\s*\n\s*basePath:[^\n]*\n\s*script: popup\.js\s*\n\s*link: popup\.css\s*\n\s*autoload: true/);
    assert.match(read('interface/clinical-workspace/popup.js'), /CONTEXT_CLASS = 'oe-workbench-context'/);
    assert.match(read('interface/clinical-workspace/popup.js'), /set\(CONTEXT_CLASS, active\)/);
    assert.match(read('interface/clinical-workspace/popup.css'), /@media screen \{[\s\S]*html\.oe-workbench-context/);
    assert.match(read('interface/main/tabs/menu/menus/standard.json'), /"label": "Pending F\/U",\s*"url": "\/interface\/orders\/pending_followup\.php",\s*"target": "rep"/);
});

test('SQL binds, ACL, CSRF, and CSV safety mutations are rejected', () => {
    const valid = insertPresentation(original);
    const mutations = [
        ['ACL', "AclMain::aclCheckCore('acct', 'rep')", "AclMain::aclCheckCore('acct', 'bill')"],
        ['date SQL binds', 'array_push($sqlBindArray, $from_date, $to_date);', 'array_push($sqlBindArray, $from_date);'],
        ['facility SQL bind', 'array_push($sqlBindArray, $form_facility);', 'array_push($sqlBindArray, $patient_id);'],
        ['billing SQL bind', '[$patient_id, $codetype, $code, $date_ordered . \' 00:00:00\']', '[$patient_id, $codetype, $code]'],
        ['export CSRF input', "if ($_POST['form_csvexport']) {\n    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);", "if ($_POST['form_csvexport']) {\n    CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);"],
        ['report CSRF input', "if ($_POST['form_refresh'] || $_POST['form_csvexport']) {\n    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);", "if ($_POST['form_refresh'] || $_POST['form_csvexport']) {\n    CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);"],
        ['CSRF token', 'CsrfUtils::collectCsrfToken(session: $session)', "'missing-token'"],
        ['CSV disposition', 'header("Content-Disposition: attachment; filename=pending_followup.csv");', 'header("Content-Disposition: inline");'],
        ['CSV escaping', "csvEscape($row['patient_name'  ])", "$row['patient_name'  ]"],
        ['HTML escaping', "text($row['patient_name'  ])", "$row['patient_name'  ]"],
        ['CSV export branch', "if ($_POST['form_csvexport']) {\n        echo csvEscape", "if ($_POST['form_refresh']) {\n        echo csvEscape"],
        ['report export condition', "if ($_POST['form_refresh'] || $_POST['form_csvexport']) {", "if ($_POST['form_refresh']) {"],
        ['form session handler', "onsubmit='return top.restoreSession()'", "onsubmit='return true'"],
        ['print handler', "win.printLogSetup(document.getElementById('printbutton'));", "win.printLogSetup(null);"],
    ];
    for (const [label, before, after] of mutations) {
        rejectMutation(valid, original, label, before, after);
    }
});

test('unscoped, print, hiding, and font style mutations are rejected', () => {
    const valid = insertPresentation(original);
    const mutations = [
        ['scope', `${SCOPE} > center {`, 'body > center {'],
        ['print', '@media screen {', '@media print {'],
        ['hiding', 'text-align: left;', 'text-align: left;\n    display: none;'],
        ['font', 'max-width: 100%;', 'max-width: 100%;\n    font-family: Arial;'],
    ];
    for (const [label, before, after] of mutations) {
        rejectMutation(valid, original, label, before, after);
    }
});

test('duplicate and relocated presentation seams are rejected', () => {
    const valid = insertPresentation(original);
    const mutations = [
        ['duplicate body', BODY_AFTER, BODY_AFTER + BODY_AFTER],
        ['duplicate style', ADDED_STYLE, ADDED_STYLE + ADDED_STYLE],
        ['relocated style', `${ADDED_STYLE}${HEAD_END}`, `${HEAD_END}${ADDED_STYLE}`],
        ['relocated body class', BODY_AFTER, BODY_BEFORE + BODY_AFTER],
    ];
    for (const [label, before, after] of mutations) {
        rejectMutation(valid, original, label, before, after);
    }
});

if (process.argv.includes('--history')) {
    test('pinned fixture and all committed, working, and untracked paths match the five-file scope', () => {
        verifyHistory(original);
    });
}

module.exports = { ADDED_STYLE, BODY_AFTER, BODY_BEFORE, SCOPE, insertPresentation, verifyPresentation, verifyStyle };
