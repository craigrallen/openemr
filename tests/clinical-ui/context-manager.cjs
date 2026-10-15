'use strict';

// Portable checks for the Nation Notes context manager popup presentation slice.
// Dependency-free and history-free: node --test tests/clinical-ui/context-manager.cjs

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ROUTE, CALLER, SHEET, ASSETS, POPUP_CSS, THEME, SCOPE, HEADER_LINE, HEAD_ADDITION, CHANGES, ADDED_CLASSES,
  STATE_GUARD, read, count, restore, parseCss, rules, declsOf, guardsOf, sheetProblems,
} = require('./context-manager-support.cjs');

// ACL gate and request handling, verbatim.
const PROLOGUE = String.raw`if (!AclMain::aclCheckCore('nationnotes', 'nn_configure')) {
    AccessDeniedHelper::denyWithTemplate("ACL check failed for nationnotes/nn_configure: Nation Notes context config", xl("Nation Notes"));
}

if (trim($_POST['contextname'] ?? '') != '' && $_POST['action'] == 'add') {
    $res = sqlStatement("SELECT * FROM customlists WHERE cl_list_type=2 AND cl_deleted=0 AND cl_list_item_long=?", [$_POST['contextname']]);
    if (!sqlNumRows($res)) {
        $id = sqlInsert("INSERT INTO customlists (cl_list_type,cl_list_item_long) VALUES(?,?)", [2,$_POST['contextname']]);
        sqlStatement("UPDATE customlists SET cl_list_id=? WHERE cl_list_slno=?", [$id,$id]);
    }
} elseif (($_POST['action'] ?? '') == 'delete' && $_POST['item'] != '') {
    sqlStatement("UPDATE customlists SET cl_deleted=1 WHERE cl_list_type=2 AND cl_list_slno=?", [$_POST['item']]);
} elseif (($_POST['action'] ?? '') == 'update' && $_POST['item'] != '') {
    sqlStatement("UPDATE customlists SET cl_list_item_long=? WHERE cl_deleted=0 AND cl_list_type=2 AND cl_list_slno=?", [$_POST['updatecontextname'],$_POST['item']]);
}
?>
<html>
`;

// Legacy inline stripes and borders, verbatim; the new sheet overrides by scope only.
const STYLE = `<style>
            .bottom {
                border-bottom: 1px solid var(--black);
            }
            .top {
                border-top: 1px solid var(--black);
            }
            .left {
                border-left: 1px solid var(--black);
            }
            .right {
                border-right:1px solid var(--black);
            }
            .class1 {
                background-color: #add9e9;
            }
            .class2 {
                background-color: #b1c0a5;
            }
        </style>`;

// The route's only inline script, verbatim.
const SCRIPT = String.raw`<script>
            $(function () {
            $('#contextadd').hide();
            $('#contextupdate').hide();
            $('#addcontextbtn').click(function() {
               $('#contextadd').show(600);
               $('#contextlist').hide(600);
               $('#addcontextbtn').hide(600);
               return false;
             });
            $('#cancel').click(function() {
               $('#contextadd').hide(600);
               $('#contextlist').show(600);
               $('#addcontextbtn').show(600);
               return false;
             });
            $('#ucancel').click(function() {
               $('#contextupdate').hide(600);
               $('#contextlist').show(600);
               $('#addcontextbtn').show(600);
               return false;
             });
            });
            function checkSubmit(){
                top.restoreSession();
                if(document.getElementById('contextname').value){
                    document.getElementById('action').value='add';
                    document.designation_managment.submit();
                }
                else{
                    alert(<?php echo xlj("Context name can't be empty"); ?>);
                }
            }
            function deleteme(id){
                top.restoreSession();
                msg = '';
                CheckContextLive(id);
                stat = document.getElementById('stat').value;
                if(stat==1){
                    msg = <?php echo xlj('This context contains categories, which will be deleted. Do you still want to continue?'); ?>;
                }
                else{
                    msg = <?php echo xlj('Do you want to delete this?'); ?>;
                }
                if(confirm(msg)){
                document.getElementById('action').value='delete';
                document.getElementById('item').value=id;
                document.designation_managment.submit();
                }
            }
            function editme(id,val){
                top.restoreSession();
                $('#contextupdate').show(600);
                $('#contextlist').hide(600);
                $('#addcontextbtn').hide(600);
                document.getElementById('item').value=id;
                document.getElementById('updatecontextname').value=val;
            }
            function checkUpdate(){
                top.restoreSession();
                if(document.getElementById('updatecontextname').value){
                document.getElementById('action').value='update';
                document.designation_managment.submit();
                }
                else{
                   alert(<?php echo xlj("Context name can't be empty"); ?>);
                }
            }
            function CheckContextLive(id){
                top.restoreSession();
                $.ajax({
                type: "POST",
                url: "ajax_code.php",
                dataType: "html",
                data: {
                     list_id: id,
                     source: "checkcontext"
                },
                async: false,
                success: function(thedata){
                    document.getElementById('stat').value=thedata;
                },
                error:function(){
                    alert("fail");
                }
                });
                return;
            }
     </script>`;

// Striped list row with its edit/delete handlers and escaping, verbatim.
const ROW = String.raw`                            <tr class="text <?php echo $class;?>">
                                <td class="right bottom left"><?php echo htmlspecialchars($i, ENT_QUOTES);?></td>
                                <td class="right bottom"><?php echo htmlspecialchars(xl($row['cl_list_item_long']), ENT_QUOTES);?></td>
                                <td class="right bottom"><a href="#" onclick='editme("<?php echo htmlspecialchars((string) $row['cl_list_slno'], ENT_QUOTES);?>","<?php echo htmlspecialchars((string) $row['cl_list_item_long'], ENT_QUOTES);?>")'><img src='<?php echo OEGlobalsBag::getInstance()->getKernel()->getImagesRelative(); ?>/b_edit.png' border=0></a></td>
                                <td class="right bottom"><a href="#" onclick="deleteme(<?php echo htmlspecialchars((string) $row['cl_list_slno'], ENT_QUOTES);?>)"><img src='<?php echo OEGlobalsBag::getInstance()->getKernel()->getImagesRelative(); ?>/deleteBtn.png' border=0></a></td>
                            </tr>
`;

// The original malformed nested anchors stay exactly as shipped.
const NESTED = [
  String.raw`<a href="#" onclick="checkSubmit()" class="btn btn-primary"><span><?php echo htmlspecialchars(xl('Save'), ENT_QUOTES);?><a href="#" id="cancel" class="btn btn-secondary"><span><?php echo htmlspecialchars(xl('Cancel'), ENT_QUOTES);?></span></a></span></a></td>`,
  String.raw`<a href="#" onclick="checkUpdate()" class="btn btn-primary"><span><?php echo htmlspecialchars(xl('Update'), ENT_QUOTES);?><a href="#" id="ucancel" class="btn btn-secondary"><span><?php echo htmlspecialchars(xl('Cancel'), ENT_QUOTES);?></span></a></span></a></td>`,
];

const HIDDEN = `            <input type="hidden" name="action" id="action">
            <input type="hidden" name="item" id="item">
            <input type="hidden" name="stat" id="stat">
`;

const route = () => read(ROUTE);

test('every presentation anchor occurs exactly once before and after the edit', () => {
  const php = route();
  for (const [, after] of CHANGES) assert.equal(count(php, after), 1, after);
  const restored = restore(php);
  assert.notEqual(restored, null);
  for (const [before] of CHANGES) assert.equal(count(restored, before), 1, before);
  assert.doesNotMatch(restored, /oe-context-manager|ClinicalWorkspaceAssets|<link /);
});

test('route links the screen-only sheet once, versioned, after the Header setup', () => {
  const php = route();
  assert.equal(count(php, 'ClinicalWorkspaceAssets'), 2);
  assert.equal(count(php, 'context-manager-popup.css'), 2);
  assert.equal(count(php, '<link '), 1);
  assert.equal(count(php, 'media="screen"'), 1);
  assert.equal(php.indexOf(HEAD_ADDITION), php.indexOf(HEADER_LINE) + HEADER_LINE.length);
  assert.ok(php.indexOf(HEAD_ADDITION) < php.indexOf('<style>'));
  assert.ok(HEAD_ADDITION.includes('attr(OEGlobalsBag::getInstance()->getWebRoot())'));
  assert.equal(count(php, 'use OpenEMR\\Core\\OEGlobalsBag;'), 1);
  assert.doesNotMatch(php, /workspace\.css|popup\.js|\$webroot/);
});

test('route keeps ACL, SQL, request handling, style, script, rows and controls', () => {
  const php = route();
  assert.equal(count(php, 'require_once("../../interface/globals.php");'), 1);
  assert.equal(count(php, PROLOGUE), 1);
  assert.equal(count(php, '<style>'), 1);
  assert.equal(php.match(/<style>[\s\S]*?<\/style>/)[0], STYLE);
  assert.equal(count(php, '<script'), 1);
  assert.equal(php.match(/<script>[\s\S]*?<\/script>/)[0], SCRIPT);
  assert.equal(count(php, '$res = sqlStatement("SELECT * FROM customlists WHERE cl_list_type=2 AND cl_deleted=0");'), 1);
  assert.equal(count(php, 'sqlStatement('), 5);
  assert.equal(count(php, 'sqlInsert('), 1);
  assert.equal(count(php, '$_'), 11);
  assert.equal(count(php, ROW), 1);
  for (const anchor of NESTED) assert.equal(count(php, anchor), 1, anchor);
  assert.equal(count(php, HIDDEN), 1);
  assert.equal(count(php, 'onclick='), 4);
  assert.equal(count(php, '<a href="#" id="addcontextbtn" class="btn btn-primary">'), 1);
  for (const id of ['contextlist', 'contextadd', 'contextupdate']) assert.equal(count(php, `<tr id="${id}">`), 1, id);
  assert.equal(count(php, '<input type="text" name="contextname" id="contextname">'), 1);
  assert.equal(count(php, '<input type="text" name="updatecontextname" id="updatecontextname">'), 1);
  assert.doesNotMatch(php, /\b(disabled|readonly|required)\b/);
});

test('route keeps its original fonts, title bars and body_top', () => {
  const php = route();
  assert.equal(count(php, 'body_top'), 1);
  assert.equal(count(php, "<td class='title_bar'"), 2);
  assert.equal(count(php, 'class="title_bar_top top right bottom'), 4);
  assert.equal(count(php, '<u><?php echo htmlspecialchars(xl(\'Add Context\'), ENT_QUOTES);?></u>'), 1);
  assert.doesNotMatch(php, /\sstyle=|<font\b/);
});

test('identifying classes sit only on the existing body, form, tables and cells', () => {
  const tagged = route().match(/<[a-z]+\b[^>]*oe-context-manager[^>]*>/g);
  assert.deepEqual(tagged.map(tag => tag.match(/^<([a-z]+)/)[1]), ['body', 'form', 'table', 'table', 'td', 'td', 'td', 'td']);
});

test('asset helper registers the sheet basename once, in sorted order', () => {
  const list = [...read(ASSETS).matchAll(/^ {8}'([\w.-]+)',$/gm)].map(match => match[1]);
  assert.equal(list.filter(name => name === 'context-manager-popup.css').length, 1);
  assert.deepEqual(list, [...list].sort());
});

test('caller still opens the route as a 500x500 iframe that refreshes on close', () => {
  const caller = read(CALLER);
  assert.equal(count(caller, '<a href="add_context.php" class="iframe_medium btn btn-primary"'), 1);
  assert.match(caller, /\$\("\.iframe_medium"\)\.on\('click', function \(e\) \{[\s\S]*?dlgopen\('', '', 500, 500, '', '', \{[\s\S]*?onClosed: 'refreshme',[\s\S]*?type: 'iframe',/);
});

const sheet = () => read(SHEET);
const allRules = () => rules(parseCss(sheet()));
const problems = css => sheetProblems(css, read(POPUP_CSS), read(THEME));
const matching = test => allRules().filter(rule => rule.selectors.some(test));

test('sheet holds every scope, token, important, pairing, guard and focus invariant', () => {
  assert.deepEqual(problems(sheet()), []);
});

test('body canvas carries the single scoped !important', () => {
  const canvas = matching(s => s === SCOPE).map(declsOf);
  assert.ok(canvas.some(d => d['background-color'] === 'var(--oe-wb-canvas) !important'));
});

test('form, sheet and list paint ink on paper; stripes alternate paper and canvas', () => {
  for (const cls of ['.oe-context-manager-sheet', '.oe-context-manager-list']) {
    assert.ok(matching(s => s.endsWith(cls)).map(declsOf).some(d => d['background-color'] === 'var(--oe-wb-paper)'), cls);
  }
  const stripe = (cls, paper) => matching(s => s.includes('.oe-context-manager-list') && s.includes(`tr.${cls}`))
    .map(declsOf).some(d => d.color === 'var(--oe-wb-ink)' && d['background-color'] === paper);
  assert.ok(stripe('class1', 'var(--oe-wb-paper)'), 'class1');
  assert.ok(stripe('class2', 'var(--oe-wb-canvas)'), 'class2');
});

test('every added class is styled by the sheet', () => {
  const css = sheet();
  for (const cls of ADDED_CLASSES) assert.match(css, new RegExp(`\\.${cls}(?![\\w-])`), cls);
});

test('fields paint paired ink and paper at rest and on :focus, guarding states', () => {
  const fields = matching(s => /#(update)?contextname\b|\binput\b/.test(s));
  for (const id of ['contextname', 'updatecontextname']) {
    assert.ok(fields.some(rule => rule.selectors.some(s => s.includes(`#${id}:not(`) || s.includes('.oe-context-manager-field input:not('))), id);
  }
  assert.ok(fields.some(rule => rule.selectors.some(s => /:not\([^()]*\)$/.test(s))
    && declsOf(rule).color === 'var(--oe-wb-ink)' && declsOf(rule)['background-color'] === 'var(--oe-wb-paper)'));
  assert.ok(fields.some(rule => rule.selectors.every(s => /:not\([^()]*\):focus$/.test(s))
    && declsOf(rule)['background-color'] === 'var(--oe-wb-paper)' && /var\(--oe-wb-petrol\)/.test(declsOf(rule).outline ?? '')));
  for (const rule of fields) for (const s of rule.selectors) assert.deepEqual(guardsOf(s), [STATE_GUARD], s);
});

test('a separate :focus-visible rule draws an outline', () => {
  const visible = matching(s => s.includes(':focus-visible'));
  assert.ok(visible.length >= 1);
  for (const rule of visible) assert.ok('outline' in declsOf(rule));
});

test('action cells may wrap', () => {
  assert.ok(matching(s => s.includes('.oe-context-manager-actions')).map(declsOf)
    .some(d => d['white-space'] === 'normal' || d['flex-wrap'] === 'wrap'));
});

// Appends a rule inside the closing of the single screen block.
const inject = (css, rule) => css.replace(/\}\n$/, () => `  ${rule}\n}\n`);
const PAIR = 'color: var(--oe-wb-ink); background-color: var(--oe-wb-paper);';
const GUARD = ':not(:disabled, .is-invalid, .is-valid, [readonly])';

test('negative controls: each forbidden sheet change is reported', () => {
  const css = sheet();
  const mutations = {
    'unauthorized important': c => inject(c, `${SCOPE} .oe-context-manager-sheet { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper) !important; }`),
    'second canvas important': c => inject(c, `${SCOPE} .oe-context-manager-form { color: var(--oe-wb-ink); background-color: var(--oe-wb-canvas) !important; }`),
    'print scope': c => c.replace(/^@media screen\b/m, '@media print'),
    'all media': c => c.replace(/^@media screen\b/m, '@media all'),
    'rule outside screen': c => `${c}${SCOPE} .text { ${PAIR} }\n`,
    'global selector': c => inject(c, `body { ${PAIR} }`),
    'other popup scope': c => inject(c, `html.oe-workbench-context.oe-workbench-popup .text { ${PAIR} }`),
    'font size': c => inject(c, `${SCOPE} .text { font-size: 1rem; }`),
    'font family': c => inject(c, `${SCOPE} .title_bar { font-family: sans-serif; }`),
    'display none': c => inject(c, `${SCOPE} #contextadd { display: none; }`),
    'overflow hiding': c => inject(c, `${SCOPE} .oe-context-manager-list { overflow: hidden; }`),
    visibility: c => inject(c, `${SCOPE} .oe-context-manager-actions { visibility: hidden; }`),
    position: c => inject(c, `${SCOPE} .oe-context-manager-actions { position: absolute; }`),
    'raw colour': c => inject(c, `${SCOPE} .text { color: #17343b; background-color: #fff; }`),
    'undefined token': c => inject(c, `${SCOPE} .text { color: var(--oe-wb-ink); background-color: var(--oe-wb-soft); }`),
    'unpaired ink': c => inject(c, `${SCOPE} .title_bar { color: var(--oe-wb-ink); }`),
    'focus fallback grouped with focus-visible': c => inject(c, `${SCOPE} .btn:focus, ${SCOPE} .btn:focus-visible { outline: 2px solid var(--oe-wb-petrol); }`),
    'validation exclusion dropped': c => inject(c, `${SCOPE} #contextname:not(:disabled, [readonly]) { ${PAIR} }`),
    'unguarded field': c => inject(c, `${SCOPE} .oe-context-manager-field input { ${PAIR} }`),
    'chained guard': c => inject(c, `${SCOPE} #contextname:not(:disabled):not(.is-invalid, .is-valid, [readonly]) { ${PAIR} }`),
    'guarded focus grouped with visible': c => inject(c, `${SCOPE} #contextname${GUARD}:focus, ${SCOPE} #contextname${GUARD}:focus-visible { ${PAIR} }`),
    'tab indentation': c => inject(c, `${SCOPE} .text {\n\tcolor: var(--oe-wb-ink); background-color: var(--oe-wb-paper);\n  }`),
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const mutated = mutate(css);
    assert.notEqual(mutated, css, name);
    assert.ok(problems(mutated).length > 0, `mutation survived: ${name}`);
  }
});
