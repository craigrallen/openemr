// Portable static contract: read the PHP route without executing it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const SOURCE = 'interface/orders/procedure_stats.php';
const FIXTURE = 'tests/clinical-ui/fixtures/procedure-statistics-original.php.txt';
const HISTORY_REF = '09b29da7771aea334ed5745e058751157af980d7';
const SCOPE = 'html.oe-workbench-context body.oe-procedure-statistics-document';
const TABLE_SELECTOR = `${SCOPE} > center > form > table.table`;
const BODY_BEFORE = "<body class='m-0'>";
const BODY_AFTER = "<body class='m-0 oe-procedure-statistics-document'>";
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
    overflow-x: auto;
  }

  ${SCOPE} > center > h2 {
    text-align: left;
    margin: 0 0 16px;
  }

  ${SCOPE} > center > form {
    max-width: 100%;
  }

  ${TABLE_SELECTOR} {
    color: #243c43;
    background-color: #fff;
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
    assert.equal(count(original, ADDED_STYLE), 0, 'fixture must lack proposed style');
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

    const csvBranch = source.indexOf('if ($form_output == 3) {\n    header("Pragma: public");');
    const htmlBranch = source.indexOf('} else {\n    ?>\n<html>');
    const style = source.indexOf(ADDED_STYLE);
    const headEnd = source.indexOf(HEAD_END);
    const body = source.indexOf(BODY_AFTER);
    const report = source.indexOf('} // end not export');
    const print = source.indexOf('win.printLogPrint(window);');
    assert.ok(csvBranch >= 0 && csvBranch < htmlBranch);
    assert.ok(htmlBranch < style && style < headEnd && headEnd < body);
    assert.ok(body < report && report < print);
    assert.equal(count(source, '<style>'), 2, 'one original and one added style block');
    assert.equal(count(source, BODY_BEFORE), 0, 'legacy body seam must be replaced');
    verifyStyle(ADDED_STYLE);
}

function verifyStyle(style) {
    assert.match(style, /^\n<style>\n@media screen \{\n/);
    assert.match(style, /\n\}\n<\/style>$/);
    const rules = [...style.matchAll(/^  ([^{}\n]+) \{\n([^{}]+)^  \}$/gm)];
    assert.equal(rules.length, 4, 'exactly four document rules');
    assert.deepEqual(rules.map(([, selector]) => selector), [
        `${SCOPE} > center`,
        `${SCOPE} > center > h2`,
        `${SCOPE} > center > form`,
        TABLE_SELECTOR,
    ]);
    assert.equal(rules[0][2],
        '    max-width: 1100px;\n    width: calc(100% - 32px);\n' +
        '    margin: 16px auto;\n    padding: clamp(12px, 2vw, 28px);\n' +
        '    border: 1px solid #d6e1e4;\n    border-radius: 8px;\n' +
        '    background: #fff;\n    color: #243c43;\n' +
        '    box-sizing: border-box;\n    overflow-x: auto;\n');
    assert.equal(rules[1][2], '    text-align: left;\n    margin: 0 0 16px;\n');
    assert.equal(rules[2][2], '    max-width: 100%;\n');
    assert.equal(rules[3][2], '    color: #243c43;\n    background-color: #fff;\n',
        'native table ink and paper must be paired');
    assert.equal(style, ADDED_STYLE, 'no extra or relocated CSS is permitted');
    assert.doesNotMatch(style, /!important|@media\s+print|display\s*:|visibility\s*:|font(?:-family|-size|-weight)?\s*:/i);
}

function rejectMutation(valid, original, label, before, after) {
    requireOnce(valid, before, `${label} mutation target`);
    const mutant = valid.replace(before, after);
    assert.notEqual(mutant, valid, `${label} mutation must change source`);
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
        FIXTURE,
        'tests/clinical-ui/procedure-statistics-document-contract.cjs',
        'tests/js/procedure-statistics-document.test.js',
        'docs/clinical-ui/PROCEDURE-STATISTICS-DOCUMENT.md',
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

test('the native route has exactly the HTML-only presentation', () => {
    verifyPresentation(source, original);
});

test('the original route is genuinely RED and synthetic insertion is valid', () => {
    assert.throws(() => verifyPresentation(original, original), /document body class/);
    verifyPresentation(insertPresentation(original), original);
});

test('the style is screen-only, scoped, and limited to the declared document rules', () => {
    verifyStyle(ADDED_STYLE);
});

test('Header autoload and the Statistics menu supply the workbench context', () => {
    assert.match(original, /Header::setupHeader\(\['datetime-picker', 'textformat', 'jquery'\]\)/);
    assert.match(read('src/Core/Header.php'), /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(read('config/config.yaml'), /workbench-popup:\s*\n\s*basePath:[^\n]*\n\s*script: popup\.js\s*\n\s*link: popup\.css\s*\n\s*autoload: true/);
    assert.match(read('interface/clinical-workspace/popup.js'), /CONTEXT_CLASS = 'oe-workbench-context'/);
    assert.match(read('interface/clinical-workspace/popup.js'), /set\(CONTEXT_CLASS, active\)/);
    assert.match(read('interface/clinical-workspace/popup.css'), /@media screen \{[\s\S]*html\.oe-workbench-context/);
    assert.match(read('interface/main/tabs/menu/menus/standard.json'), /"label": "Statistics",\s*"url": "\/interface\/orders\/procedure_stats\.php",\s*"target": "rep"/);
});

test('native modes, dynamic columns, and report generation remain present', () => {
    for (const fragment of [
        "[1 => xl('Screen'), 2 => xl('Printer'), 3 => xl('Export File')]",
        "foreach ($arr_show as $key => $value)",
        "name='form_show[]' size='4' multiple",
        "if ($form_by === '5')",
        "explode(';', (string) $row['related_code'])",
        "foreach ($form_show as $value)",
        "if ($value == '.tneg')",
        "elseif ($value == '.age')",
        "for ($i = 0; $i < 9; ++$i)",
        "!empty($arr_show[$value]['list_id'])",
        "!empty($arr_titles[$value])",
        "proc_stats_getListTitle($arr_show[$value]['list_id'], $key)",
        "echo \"<table class='table' cellpadding='1' cellspacing='2' width='98%'>\\n\";",
        "genStartRow(\"bgcolor='#dddddd'\");",
        '"#ddddff" : "#ffdddd"',
        "if ($form_output != 3)",
        "if ($form_output == 2)",
    ]) assert.ok(original.includes(fragment), `missing native fragment: ${fragment}`);
});

test('SQL, ACL, CSRF, session, escaping, CSV, and printer mutations are rejected', () => {
    const valid = insertPresentation(original);
    const mutations = [
        ['ACL', "AclMain::aclCheckCore('patients', 'lab')", "AclMain::aclCheckCore('patients', 'demo')"],
        ['date binds', 'array_push($sqlBindArray, $from_date, $to_date);', 'array_push($sqlBindArray, $from_date);'],
        ['facility bind', 'array_push($sqlBindArray, $form_facility);', 'array_push($sqlBindArray, $patient_id);'],
        ['final results', 'AND ps.result_status = \'final\'', 'AND ps.result_status = \'draft\''],
        ['submit CSRF', 'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', 'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);'],
        ['CSRF token', 'CsrfUtils::collectCsrfToken(session: $session)', "'missing-token'"],
        ['active session', 'SessionWrapperFactory::getInstance()->getActiveSession()', 'null'],
        ['form session', "onsubmit='return top.restoreSession()'", "onsubmit='return true'"],
        ['HTML escaping', 'echo ">" . text($datum) . "</td>\\n";', 'echo ">" . $datum . "</td>\\n";'],
        ['CSV escaping', "echo '\"' . attr($datum) . '\"';", "echo '\"' . $datum . '\"';"],
        ['CSV branch', 'if ($form_output == 3) {\n    header("Pragma: public");', 'if ($form_output == 2) {\n    header("Pragma: public");'],
        ['CSV type', 'header("Content-Type: application/force-download");', 'header("Content-Type: text/html");'],
        ['CSV disposition', 'header("Content-Disposition: attachment; filename=service_statistics_report.csv");', 'header("Content-Disposition: inline");'],
        ['CSV function path', 'if ($form_output == 3) {\n            if ($cellcount)', 'if ($form_output == 2) {\n            if ($cellcount)'],
        ['printer callback', 'win.printLogPrint(window);', 'win.printLogPrint(null);'],
        ['printer condition', '<?php if ($form_output == 2) { ?>', '<?php if ($form_output == 1) { ?>'],
    ];
    for (const [label, before, after] of mutations) rejectMutation(valid, original, label, before, after);
});

test('CSS scope, media, hiding, font, palette, and overflow mutations are rejected', () => {
    const valid = insertPresentation(original);
    const mutations = [
        ['scope', `${SCOPE} > center {`, 'body > center {'],
        ['media', '@media screen {', '@media print {'],
        ['hiding', '    text-align: left;\n', '    text-align: left;\n    display: none;\n'],
        ['font', '    max-width: 100%;\n', '    max-width: 100%;\n    font-family: Arial;\n'],
        ['important', '    border-radius: 8px;\n', '    border-radius: 8px !important;\n'],
        ['overflow', '    overflow-x: auto;\n', ''],
        ['table selector', `${TABLE_SELECTOR} {`, `${SCOPE} table {`],
        ['missing table ink', `  ${TABLE_SELECTOR} {\n    color: #243c43;\n`, `  ${TABLE_SELECTOR} {\n`],
        ['mismatched table ink', `  ${TABLE_SELECTOR} {\n    color: #243c43;\n`, `  ${TABLE_SELECTOR} {\n    color: #f8f9fa;\n`],
        ['missing table paper', '    background-color: #fff;\n', ''],
        ['mismatched table paper', '    background-color: #fff;\n', '    background-color: #243c43;\n'],
    ];
    for (const [label, before, after] of mutations) rejectMutation(valid, original, label, before, after);
});

test('duplicate and relocated seams are rejected', () => {
    const valid = insertPresentation(original);
    const mutations = [
        ['duplicate body', BODY_AFTER, BODY_AFTER + BODY_AFTER],
        ['duplicate style', ADDED_STYLE, ADDED_STYLE + ADDED_STYLE],
        ['style after head', `${ADDED_STYLE}${HEAD_END}`, `${HEAD_END}${ADDED_STYLE}`],
        ['body before original', BODY_AFTER, BODY_BEFORE + BODY_AFTER],
    ];
    for (const [label, before, after] of mutations) rejectMutation(valid, original, label, before, after);
});

if (process.argv.includes('--history')) {
    test('pinned fixture and committed, working, and untracked paths obey five-file scope', () => {
        verifyHistory(original);
    });
}

module.exports = { ADDED_STYLE, BODY_AFTER, BODY_BEFORE, SCOPE, insertPresentation, verifyPresentation, verifyStyle };
