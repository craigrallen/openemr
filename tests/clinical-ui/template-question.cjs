'use strict';

// Portable checks for the template question popup presentation slice.
// Dependency-free and history-free: node --test tests/clinical-ui/template-question.cjs

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ROUTE, SHEET, ASSETS, POPUP_CSS, THEME, SCOPE, HEAD_ADDITION, CHANGES,
  read, count, restore, parseCss, rules,
} = require('./template-question-support.cjs');

// The route's only inline script, verbatim.
const SCRIPT = String.raw`<script>
            function showWhereInTextarea() {
                opener.restoreSession();
                var textarea = document.getElementById('quest');
                start = textarea.value.indexOf("??");
                len = 2;
                if (textarea.setSelectionRange) {
                    textarea.setSelectionRange(parseInt(start), (parseInt(start) + parseInt(len)));
                } else {
                    var range = textarea.createTextRange();
                    range.collapse(true);

                    range.moveStart('character', parseInt(start));
                    range.moveEnd('character', parseInt(len));
                    range.select();
                }
                document.getElementById('quest').focus();
            }

            function replace_quest(val) {
                opener.restoreSession();
                var textarea = document.getElementById('quest').value;
                textarea = textarea.replace(/\?\?/i, val);
                document.getElementById('quest').value = textarea;
            }

            function save_this() {
                opener.restoreSession();
                var textFrom = document.getElementById('quest').value;
                if (window.opener.updateEditorContent) {
                    window.opener.updateEditorContent(textFrom);
                } else {
                    alert(xl("A system error occurred in updating your content. Please try again. If the problem persists, please contact the system administrator."));
                    console.error("updateEditorContent not found in parent window");
                }
                window.close();
            }
        </script>`;

const route = () => read(ROUTE);

test('route links the screen-only sheet once, versioned, after the Header setup', () => {
  const php = route();
  for (const [, after] of CHANGES) assert.equal(count(php, after), 1, after);
  assert.equal(count(php, 'ClinicalWorkspaceAssets'), 2);
  assert.equal(count(php, 'template-question-popup.css'), 2);
  assert.equal(count(php, '<link '), 1);
  const header = php.indexOf("<?php Header::setupHeader('opener'); ?>\n");
  assert.equal(php.indexOf(HEAD_ADDITION), header + "<?php Header::setupHeader('opener'); ?>\n".length);
  assert.ok(php.indexOf(HEAD_ADDITION) < php.indexOf('<script>'));
  assert.ok(HEAD_ADDITION.includes('attr(OEGlobalsBag::getInstance()->getWebRoot())'));
  assert.ok(!HEAD_ADDITION.includes('$webroot'));
  assert.equal(count(php, 'use OpenEMR\\Core\\OEGlobalsBag;'), 1);
});

test('route keeps its inline script, handlers, SQL, escaping, request and controls', () => {
  const php = route();
  assert.equal(count(php, '<script'), 1);
  assert.equal(php.match(/<script>[\s\S]*?<\/script>/)[0], SCRIPT);
  assert.deepEqual(php.match(/\son\w+="[^"]*"/g), [
    ' onload="showWhereInTextarea()"',
    " onclick=\"replace_quest('<?php echo htmlspecialchars((string) $row['option_id'], ENT_QUOTES);?>')\"",
    ' onclick="save_this()"',
    ' onclick="javascript:window.close()"',
  ]);
  assert.equal(count(php, "$content = $_REQUEST['content'];"), 1);
  assert.equal(count(php, '$_'), 1);
  assert.equal(count(php, 'sqlStatement('), 1);
  assert.equal(count(php, "sqlStatement(\"SELECT * FROM list_options WHERE list_id = 'nation_notes_replace_buttons' AND activity = 1 ORDER BY seq\")"), 1);
  assert.equal(count(php, 'while ($row = sqlFetchArray($res)) {'), 1);
  assert.deepEqual(php.match(/htmlspecialchars\([^;]*?ENT_QUOTES\)/g), [
    "htmlspecialchars((string) $row['option_id'], ENT_QUOTES)",
    "htmlspecialchars((string) $row['title'], ENT_QUOTES)",
    'htmlspecialchars((string) $content, ENT_QUOTES)',
    "htmlspecialchars(xl('Save'), ENT_QUOTES)",
    "htmlspecialchars(xl('Cancel'), ENT_QUOTES)",
  ]);
  assert.equal(count(php, ' class="btn btn-primary"><span>'), 1);
  assert.equal(count(php, '                <textarea name="quest" id="quest" rows="12" cols="70"><?php echo htmlspecialchars((string) $content, ENT_QUOTES);?></textarea>\n'), 1);
  assert.equal(count(php, '<input type="button" name="save" value="'), 1);
  assert.equal(count(php, '<input type="button" name="cancel" value="'), 1);
  assert.equal(count(php, 'require_once("../../interface/globals.php");'), 1);
  // Fonts: the legacy .text rows stay, and no inline style is introduced.
  assert.equal(count(php, '<tr class="text">'), 2);
  assert.equal(count(php, '<tr>'), 1);
  assert.doesNotMatch(php, /\sstyle=/);
});

test('identifying classes sit only on the existing body, table and cells', () => {
  const php = route();
  const tagged = php.match(/<[a-z]+\b[^>]*oe-template-question[^>]*>/g);
  assert.equal(tagged.length, 5);
  for (const tag of tagged) assert.match(tag, /^<(body|table|td)\b/);
  const restored = restore(php);
  assert.notEqual(restored, null);
  assert.doesNotMatch(restored, /oe-template-question|ClinicalWorkspaceAssets|<link /);
  assert.equal(count(restored, '<td>'), 2);
});

test('asset helper registers the sheet basename in sorted order', () => {
  const list = [...read(ASSETS).matchAll(/^ {8}'([\w.-]+)',$/gm)].map(match => match[1]);
  assert.ok(list.includes('template-question-popup.css'));
  assert.deepEqual(list, [...list].sort());
});

const sheet = () => read(SHEET);
const tree = () => parseCss(sheet());
const allRules = () => rules(tree());
const declsOf = rule => Object.fromEntries(rule.decls.map(d => [d.prop, `${d.value}${d.important ? ' !important' : ''}`]));
const ruleFor = selector => allRules().filter(rule => rule.selectors.includes(selector));

test('sheet is a single screen block scoped to the workbench popup mode and own body', () => {
  const top = tree();
  assert.equal(top.length, 1);
  assert.equal(top[0].type, 'atrule');
  assert.equal(`${top[0].name} ${top[0].params}`, 'media screen');
  assert.ok(top[0].nodes.every(node => node.type === 'rule'));
  for (const rule of allRules()) {
    for (const selector of rule.selectors) {
      assert.ok(selector === SCOPE || selector.startsWith(`${SCOPE} `), selector);
    }
  }
});

test('sheet uses popup.css tokens, keeps fonts and visibility, and no raw colours', () => {
  const defined = new Set([...read(POPUP_CSS).matchAll(/^\s*(--oe-wb-[\w-]+):/gm)].map(match => match[1]));
  const used = [...sheet().matchAll(/var\((--[\w-]+)\)/g)].map(match => match[1]);
  assert.ok(used.length > 0);
  for (const name of used) assert.ok(defined.has(name), name);
  const banned = /^(font|font-[\w-]+|line-height|letter-spacing|text-transform|visibility|position|pointer-events|user-select|opacity|content|zoom|transform)$/;
  for (const rule of allRules()) {
    for (const { prop, value } of rule.decls) {
      assert.doesNotMatch(prop, banned, prop);
      assert.ok(!(prop === 'display' && /none/.test(value)), 'display: none');
      assert.doesNotMatch(value, /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i, `${prop}: ${value}`);
    }
  }
});

test('body canvas overrides the theme body_top !important only on the exact scope', () => {
  const themeImportant = /\.body_top,\n\.bgcolor2,\n\.body_nav \{\n {2}background-color: \$paler !important;/.test(read(THEME));
  const canvas = ruleFor(SCOPE).map(declsOf);
  assert.ok(canvas.some(d => d['background-color'] === `var(--oe-wb-canvas)${themeImportant ? ' !important' : ''}`));
  const important = allRules().flatMap(rule => rule.decls.filter(d => d.important).map(d => ({ rule, d })));
  assert.equal(important.length, themeImportant ? 1 : 0);
  for (const { rule, d } of important) {
    assert.deepEqual(rule.selectors, [SCOPE]);
    assert.equal(`${d.prop}: ${d.value}`, 'background-color: var(--oe-wb-canvas)');
  }
});

test('original table is the paper sheet', () => {
  const paper = allRules().filter(rule => rule.selectors.some(s => s.endsWith('.oe-template-question-sheet')));
  assert.ok(paper.some(rule => declsOf(rule)['background-color'] === 'var(--oe-wb-paper)'));
});

// The textarea paint must leave readonly, disabled and validation states to the theme.
const STATE_GUARD = [':disabled', '.is-invalid', '.is-valid', '[readonly]'].sort();
const guardOf = selector => {
  const match = selector.match(/#quest:not\(([^()]*)\)/);
  return match ? match[1].split(',').map(part => part.trim()).sort() : null;
};

test('textarea paints paired ink and paper at rest and on focus, guarding field states', () => {
  const quest = allRules().filter(rule => rule.selectors.some(s => s.includes('#quest')));
  assert.ok(quest.length >= 2);
  for (const rule of quest) {
    for (const selector of rule.selectors) {
      assert.deepEqual(guardOf(selector), STATE_GUARD, selector);
      assert.doesNotMatch(selector, /\):not\(/, 'use one complex :not()');
    }
    const d = declsOf(rule);
    assert.equal('color' in d, 'background-color' in d, 'ink and paper are paired');
  }
  const rest = quest.filter(rule => rule.selectors.some(s => /#quest:not\([^()]*\)$/.test(s)));
  assert.ok(rest.some(rule => declsOf(rule).color === 'var(--oe-wb-ink)' && declsOf(rule)['background-color'] === 'var(--oe-wb-paper)'));
  const focus = quest.filter(rule => rule.selectors.some(s => /:focus$/.test(s)));
  assert.ok(focus.some(rule => {
    const d = declsOf(rule);
    return d.color === 'var(--oe-wb-ink)' && d['background-color'] === 'var(--oe-wb-paper)' && /var\(--oe-wb-petrol\)/.test(d.outline ?? '');
  }));
});

test('focus fallback and :focus-visible live in separate rules', () => {
  const visible = allRules().filter(rule => rule.selectors.some(s => s.includes(':focus-visible')));
  assert.ok(visible.length >= 1);
  for (const rule of allRules()) {
    const kinds = new Set(rule.selectors.map(s => s.includes(':focus-visible')));
    assert.equal(kinds.size, 1, rule.selectors.join(', '));
  }
  for (const rule of visible) assert.ok('outline' in declsOf(rule));
});

test('option buttons and actions may wrap', () => {
  for (const cell of ['.oe-template-question-options', '.oe-template-question-actions']) {
    const wraps = allRules().filter(rule => rule.selectors.some(s => s.includes(cell))).some(rule => {
      const d = declsOf(rule);
      return d['flex-wrap'] === 'wrap' || d['white-space'] === 'normal';
    });
    assert.ok(wraps, cell);
  }
});

test('sheet formatting: two-space indentation, no tabs, modern :not()', () => {
  const css = sheet();
  assert.doesNotMatch(css, /\t/);
  for (const line of css.split('\n')) {
    if (line.trim() && !/^\s*\*/.test(line)) assert.match(line, /^( {2})*\S/, line);
  }
  assert.doesNotMatch(css, /\):not\(/);
  assert.ok(css.endsWith('}\n'));
});
