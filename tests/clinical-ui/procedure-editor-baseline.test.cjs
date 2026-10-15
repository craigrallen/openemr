'use strict';

/*
 * Procedure type editor (interface/orders/types_edit.php) baseline guards.
 *
 * Requires git history: the baseline is the route, caller and shared assets at
 * BASE_COMMIT, read as raw git blobs so every byte outside the declared
 * presentation edits is pinned. Mandatory for local source verification:
 *
 *   node --test tests/clinical-ui/procedure-editor-baseline.test.cjs
 *
 * The history-independent guards live in procedure-editor.test.cjs.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
    root, ROUTE, HELPER, SHEET, SHEET_NAME, BASELINE_SUPPORTED, changes, read, count, restore, supportedList,
} = require('./procedure-editor-support.cjs');

const BASE_COMMIT = '18647270';
const base = file => execFileSync('git', ['cat-file', 'blob', `${BASE_COMMIT}:${file}`], { cwd: root }).toString('utf8');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');

test('route: only the declared presentation edits restore the exact base route', () => {
    const original = base(ROUTE);
    for (const [before] of changes) assert.equal(count(original, before), 1, `anchor not unique in base: ${before}`);
    const php = read(ROUTE);
    for (const [, after] of changes) assert.equal(count(php, after), 1, `presentation edit missing: ${after}`);
    const restored = restore(php);
    assert.notEqual(restored, null);
    assert.equal(sha(restored), sha(original));
});

test('route: business, security, callback, font and inherited-quirk mutations break restoration', () => {
    const php = read(ROUTE);
    const baseline = sha(base(ROUTE));
    const mutations = [
        // ACL, CSRF, restoreSession
        ["if (!AclMain::aclCheckCore('admin', 'super')) {", 'if (false) {'],
        ['CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', ''],
        ['CsrfUtils::collectCsrfToken(session: $session)', "''"],
        ["onsubmit='return top.restoreSession()'", "onsubmit='return true'"],
        ['<?php require(OEGlobalsBag::getInstance()->getSrcDir() . "/restoreSession.php"); ?>', ''],
        ["Header::setupHeader(['opener', 'topdialog', 'datetime-picker']);", "Header::setupHeader(['topdialog', 'datetime-picker']);"],
        // SQL and recursive delete
        ["        recursiveDelete($row['procedure_type_id']);", ''],
        ['                recursiveDelete($typeid);', ''],
        ['sqlStatement("UPDATE procedure_type SET $sets WHERE procedure_type_id = ?", $bindValues);', 'sqlStatement("UPDATE procedure_type SET $sets", $bindValues);'],
        ['sqlInsert("INSERT INTO procedure_type SET parent = ?, $sets", $bindValues)', 'sqlInsert("INSERT INTO procedure_type SET $sets", $bindValues)'],
        ['$ppres = sqlStatement("SELECT ppid, name FROM procedure_providers WHERE ppid = ? ORDER BY name, ppid", [$labid]);', '$ppres = sqlStatement("SELECT ppid, name FROM procedure_providers ORDER BY name, ppid");'],
        ["isset($_POST['form_diagnosis_code']) ? types_invalue('form_diagnosis_code') : types_invalue('form_related_code'),", "types_invalue('form_related_code'),"],
        // addfav / disabled state and options
        ["$ordtype = $_REQUEST['addfav'] ?? '';", "$ordtype = '';"],
        ['$disabled = $ordtype ? "disabled" : \'\';', "$disabled = '';"],
        ['"$disabled",', '"",'],
        ["class='form-control <?php echo $ord_disabled; ?>'", "class='form-control'"],
        ["'proc_type_changed()'", "''"],
        ["$('.ordonly').hide();", ''],
        // popup callbacks and opener refresh
        ['function set_related(codetype, code, selector, codedesc) {', 'function setRelated(codetype, code, selector, codedesc) {'],
        ['function get_related() {', 'function getRelated() {'],
        ['my_del_related(s, document.forms[0][rcvarname], false);', ''],
        ["dlgopen(url, '_codeslkup', 985, 800, '', <?php echo xlj(\"Select Default Codes\"); ?>);", ''],
        ['function set_new_fav(result) {', 'function setNewFav(result) {'],
        ["dlgopen('find_order_popup.php?addfav=1&labid=' + labid, '_blank', 850, 500, '', title);", ''],
        ["onclick='sel_related(\"form_diagnosis_code\")'", ''],
        ["onclick='sel_related(\"form_related_code\")'", ''],
        ['echo " if (opener.refreshFamily) opener.refreshFamily(" . js_escape($parent) . ",\'true\');\\n";', ''],
        // actions
        ['<?php if ($typeid) { ?>', '<?php if (true) { ?>'],
        ["name='form_delete'", "name='form_remove'"],
        ["type='submit' name='form_save'", "type='button' name='form_save'"],
        ["onclick='window.close()' ;", "onclick=''"],
        // original fonts and inline presentation
        ['font-size: 10pt;', 'font-size: 12pt;'],
        ['pointer-events: none;', ''],
        ['.label-div:hover > a {', '.label-div:focus-within > a {'],
        // inherited markup quirks stay byte-identical
        ["id=='form_seq'", "id='form_seq'"],
        ["id='form_name '", "id='form_name'"],
    ];
    for (const [from, to] of mutations) {
        assert.equal(count(php, from), 1, `mutation anchor not unique: ${from}`);
        const restored = restore(php.replace(from, () => to));
        assert.notEqual(restored === null ? null : sha(restored), baseline, `mutation survived: ${from}`);
    }
    // A stray class outside the declared list is caught too.
    const stray = restore(php.replace("id='form_procedure_code'", () => "id='form_procedure_code' class='oe-extra'"));
    assert.notEqual(stray === null ? null : sha(stray), baseline);
});

// ---------------------------------------------------------------------------
// Caller, shared popup engine and neighbouring routes: byte-identical to base.
// ---------------------------------------------------------------------------
test('caller, shared popup engine and callback routes are unchanged', () => {
    const pinned = [
        'interface/orders/types.php',
        'interface/orders/find_order_popup.php',
        'interface/patient_file/encounter/find_code_dynamic.php',
        'config/config.yaml',
        'src/Core/Header.php',
        'library/dialog.js',
    ];
    const tracked = execFileSync('git', ['ls-tree', '--name-only', BASE_COMMIT, 'interface/clinical-workspace/'], { cwd: root })
        .toString('utf8').split('\n').filter(Boolean);
    assert.ok(tracked.includes('interface/clinical-workspace/popup.css'));
    assert.ok(tracked.includes('interface/clinical-workspace/popup.js'));
    for (const file of [...pinned, ...tracked]) assert.equal(sha(read(file)), sha(base(file)), `changed: ${file}`);
    // The only new clinical-workspace file is this route's sheet.
    const now = fs.readdirSync(path.join(root, 'interface/clinical-workspace')).map(name => `interface/clinical-workspace/${name}`);
    assert.deepEqual(now.filter(file => !tracked.includes(file)), [SHEET]);
});

test('asset helper: exactly one sorted allowlist entry and no other change', () => {
    const entry = `        '${SHEET_NAME}',\n`;
    const php = read(HELPER);
    assert.equal(count(php, entry), 1);
    assert.equal(sha(php.replace(entry, () => '')), sha(base(HELPER)));
    // The portable suite's copied baseline names match the base commit exactly.
    assert.deepEqual(supportedList(base(HELPER)), BASELINE_SUPPORTED);
    const expected = [...supportedList(base(HELPER)), SHEET_NAME].sort();
    assert.deepEqual(supportedList(php), expected);
});
