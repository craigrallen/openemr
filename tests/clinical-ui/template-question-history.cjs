'use strict';

// Local, explicit history check (needs this git checkout and the base commit):
//   node --test tests/clinical-ui/template-question-history.cjs
// Inverting the declared presentation edits must reproduce the base route and
// asset helper byte for byte; the caller and shared popup/theme sources stay untouched.

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const {
  ROOT, ROUTE, ASSETS, POPUP_CSS, THEME, ASSET_LINE, read, count, restore,
} = require('./template-question-support.cjs');

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

test('caller and shared popup and theme sources are byte-identical to the base', () => {
  for (const file of [
    'library/js/ajax_functions_writer.js',
    POPUP_CSS,
    'interface/clinical-workspace/popup.js',
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
    'interface/clinical-workspace/template-question-popup.css',
    'tests/clinical-ui/template-question-support.cjs',
    'tests/clinical-ui/template-question.cjs',
    'tests/clinical-ui/template-question-history.cjs',
    'tests/js/template-question-popup.test.js',
    'docs/clinical-ui/TEMPLATE-QUESTION-POPUP.md',
  ]);
  const changed = git(['diff', '--name-only', BASE, '--']).toString('utf8').split('\n').filter(Boolean);
  for (const file of changed) assert.ok(allowed.has(file), file);
});

test('negative controls: protected mutations or stray edits break restoration', () => {
  const php = read(ROUTE);
  const mutations = [
    ['require_once("../../interface/globals.php");', ''],
    ["$content = $_REQUEST['content'];", "$content = $_GET['content'];"],
    ["Header::setupHeader('opener');", 'Header::setupHeader();'],
    ["opener.restoreSession();\n                var textarea = document.getElementById('quest');", "var textarea = document.getElementById('quest');"],
    ['textarea.replace(/\\?\\?/i, val)', 'textarea.replace(/\\?\\?/gi, val)'],
    ['window.opener.updateEditorContent(textFrom);', ''],
    ['                window.close();\n            }\n        </script>', '            }\n        </script>'],
    ['A system error occurred in updating your content.', 'An error occurred.'],
    [' onload="showWhereInTextarea()"', ''],
    ["AND activity = 1 ORDER BY seq", 'ORDER BY seq'],
    ['ORDER BY seq', 'ORDER BY title'],
    ["htmlspecialchars((string) $row['option_id'], ENT_QUOTES)", "htmlspecialchars((string) $row['option_id'])"],
    ["htmlspecialchars((string) $row['title'], ENT_QUOTES)", "text($row['title'])"],
    ['<?php echo htmlspecialchars((string) $content, ENT_QUOTES);?></textarea>', '<?php echo $content;?></textarea>'],
    ['class="btn btn-primary"', 'class="btn btn-secondary"'],
    ['rows="12" cols="70"', 'rows="6" cols="70"'],
    ['<textarea name="quest"', '<textarea style="font-size: 16px" name="quest"'],
    ['</tr>\n            <tr class="text">', '</tr>\n            <tr>'],
    ['onclick="save_this()"', 'onclick="save_this();window.close()"'],
    ['onclick="javascript:window.close()"', 'onclick="dlgclose()"'],
    ["<tr>\n                <td colspan", "<tr class=\"oe-template-question-row\">\n                <td colspan"],
    ['<input type="button" name="save"', '<input type="button" class="oe-template-question-save" name="save"'],
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
