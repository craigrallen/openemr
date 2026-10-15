'use strict';

// Local, explicit history check (needs this git checkout and the base commit):
//   node --test tests/clinical-ui/context-manager-history.cjs
// Inverting the declared presentation edits must reproduce the base route and
// asset helper byte for byte; the caller and shared popup/theme sources stay untouched.

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const {
  ROOT, ROUTE, CALLER, SHEET, ASSETS, POPUP_CSS, THEME, ASSET_LINE, read, count, restore,
} = require('./context-manager-support.cjs');

const BASE = '18647270e0c799189d2dc10f801e8de2bff1a360';
const git = args => execFileSync('git', args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
const original = file => git(['show', `${BASE}:${file}`]);
const bytes = text => (text === null ? null : Buffer.from(text, 'utf8'));
const same = (text, file) => {
  const restored = bytes(text);
  return restored !== null && restored.equals(original(file));
};

test('inverting the presentation edits restores the entire original route', () => {
  assert.ok(same(restore(read(ROUTE)), ROUTE));
});

test('removing the one basename restores the original asset helper', () => {
  const helper = read(ASSETS);
  assert.equal(count(helper, ASSET_LINE), 1);
  assert.ok(same(helper.replace(ASSET_LINE, ''), ASSETS));
});

test('caller and shared popup, workspace and theme sources are byte-identical to the base', () => {
  for (const file of [
    CALLER,
    'library/custom_template/ajax_code.php',
    POPUP_CSS,
    'interface/clinical-workspace/popup.js',
    'interface/clinical-workspace/workspace.css',
    THEME,
    'src/Core/Header.php',
  ]) {
    assert.ok(same(read(file), file), file);
  }
});

test('tracked changes against the base stay within the declared files', () => {
  const allowed = new Set([
    ROUTE,
    ASSETS,
    SHEET,
    'tests/clinical-ui/context-manager-support.cjs',
    'tests/clinical-ui/context-manager.cjs',
    'tests/clinical-ui/context-manager-history.cjs',
    'tests/js/context-manager-popup.test.js',
    'docs/clinical-ui/CONTEXT-MANAGER-POPUP.md',
  ]);
  const changed = git(['diff', '--name-only', BASE, '--']).toString('utf8').split('\n').filter(Boolean);
  for (const file of changed) assert.ok(allowed.has(file), file);
});

test('negative controls: protected mutations or stray edits break restoration', () => {
  const php = read(ROUTE);
  const mutations = [
    ['require_once("../../interface/globals.php");', ''],
    ["aclCheckCore('nationnotes', 'nn_configure')", "aclCheckCore('nationnotes', 'nn_view')"],
    ['AccessDeniedHelper::denyWithTemplate("ACL check failed', 'error_log("ACL check failed'],
    ["trim($_POST['contextname'] ?? '') != ''", "($_POST['contextname'] ?? '') != ''"],
    ['cl_list_type=2 AND cl_deleted=0 AND cl_list_item_long=?', 'cl_list_type=2 AND cl_list_item_long=?'],
    ['SET cl_deleted=1 WHERE cl_list_type=2 AND cl_list_slno=?', 'SET cl_deleted=1 WHERE cl_list_slno=?'],
    ['WHERE cl_deleted=0 AND cl_list_type=2 AND cl_list_slno=?', 'WHERE cl_list_slno=?'],
    ['cl_list_type=2 AND cl_deleted=0");', 'cl_list_type=2 AND cl_deleted=0 ORDER BY cl_list_slno");'],
    ["Header::setupHeader('opener');", 'Header::setupHeader();'],
    ['background-color: #add9e9;', 'background-color: var(--oe-wb-paper);'],
    ["            $('#contextadd').hide();\n", ''],
    ["top.restoreSession();\n                if(document.getElementById('contextname').value){", "if(document.getElementById('contextname').value){"],
    ["msg = <?php echo xlj('Do you want to delete this?'); ?>;", "msg = 'Do you want to delete this?';"],
    ['async: false,', 'async: true,'],
    ['<tr class="text <?php echo $class;?>">', '<tr class="<?php echo $class;?>">'],
    ['<body class="body_top oe-context-manager">', '<body class="oe-context-manager">'],
    ["<td class='title_bar' colspan=\"4\"", "<td class='title_bar' style=\"font-size: 16px\" colspan=\"4\""],
    ["htmlspecialchars(xl($row['cl_list_item_long']), ENT_QUOTES)", "xl($row['cl_list_item_long'])"],
    ["onclick=\"deleteme(<?php echo htmlspecialchars((string) $row['cl_list_slno'], ENT_QUOTES);?>)\"", "onclick=\"deleteme(<?php echo $row['cl_list_slno'];?>)\""],
    ["/deleteBtn.png' border=0>", "/deleteBtn.png'>"],
    ["<?php echo htmlspecialchars(xl('Save'), ENT_QUOTES);?><a href=\"#\" id=\"cancel\"", "<?php echo htmlspecialchars(xl('Save'), ENT_QUOTES);?></span></a><a href=\"#\" id=\"cancel\""],
    ['<input type="hidden" name="stat" id="stat">', ''],
    ['<tr id="contextlist">', '<tr id="contextlist" class="oe-context-manager-row">'],
    ['<input type="text" name="contextname" id="contextname">', '<input type="text" name="contextname" id="contextname" class="oe-context-manager-input">'],
    ['media="screen"', 'media="all"'],
  ];
  for (const [from, to] of mutations) {
    assert.equal(count(php, from), 1, `anchor not unique: ${from}`);
    assert.notEqual(from, to);
    const mutated = php.replace(from, () => to);
    assert.notEqual(mutated, php);
    assert.ok(!same(restore(mutated), ROUTE), `mutation survived: ${from}`);
  }
});
