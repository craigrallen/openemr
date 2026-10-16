/** @jest-environment jsdom */

// OPEMR-8: Edit Facility Specific User Information as a workbench popup document.
// Source and selector contracts only: these tests do not compute the native cascade, render the
// popup, or exercise authentication. Native visual acceptance is a separate step.

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = () => read('interface/usergroup/facility_user_admin.php');
const fixture = read('tests/clinical-ui/fixtures/facility-user-original.txt');
const cssFile = path.join(root, 'interface/clinical-workspace/facility-user-popup.css');
// The sheet does not exist before implementation; read it as empty so assertions fail, not the suite.
const css = () => (fs.existsSync(cssFile) ? fs.readFileSync(cssFile, 'utf8') : '');
const count = (text, part) => text.split(part).length - 1;

// The four planned replacements, as [original, presented].
const header = "    <?php Header::setupHeader(['common', 'datetime-picker', 'opener', 'select2']); ?>\n";
const changes = [
    ['use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;',
        'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;'],
    [header, `${header}    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/facility-user-popup.css?v=<?php echo attr_url((new ClinicalWorkspaceAssets())->version('facility-user-popup.css')); ?>">\n`],
    ['\n<body>\n', '\n<body class="oe-facility-user-popup">\n'],
    ['    <div class="container">\n', '    <div class="container oe-facility-user-document">\n'],
];
const apply = text => changes.reduce((out, [before, after]) => out.replace(before, () => after), text);
// Undo the presentation; null when any presented form is missing or ambiguous.
const restore = text => {
    let out = text;
    for (const [before, after] of changes) {
        if (count(out, after) !== 1) return null;
        out = out.replace(after, () => before);
    }
    return out;
};
const accepted = text => text === fixture || text === apply(fixture);

test('the fixture freezes the untouched 229-line route and every planned anchor is unique', () => {
    expect(fixture.split('\n')).toHaveLength(230);
    expect(fixture.endsWith('</body>\n\n</html>\n')).toBe(true);
    for (const [before, after] of changes) {
        expect(before).not.toBe(after);
        expect(count(fixture, before)).toBe(1);
        expect(count(fixture, after)).toBe(0);
    }
    const planned = apply(fixture);
    expect(planned).not.toBe(fixture);
    for (const [, after] of changes) expect(count(planned, after)).toBe(1);
    expect(restore(planned)).toBe(fixture);
    expect(restore(fixture)).toBeNull();
});

test('preservation: the route is the untouched original or exactly the planned presentation', () => {
    expect(accepted(source())).toBe(true);
});

test('desired presentation: the route carries exactly the four planned replacements', () => {
    const php = source();
    expect(php).toBe(apply(fixture));
    expect(count(php, 'facility-user-popup.css')).toBe(2);
    expect(count(php, '<body')).toBe(1);
});

test('negative controls: guard, request, SQL, form, escaping, script and layout mutations are rejected', () => {
    const mutations = [
        ["AclMain::aclCheckCore('admin', 'users')", "AclMain::aclCheckCore('admin', 'super')"],
        ['if (!isset($_GET["user_id"]) || !isset($_GET["fac_id"])) {', 'if (!isset($_GET["user_id"])) {'],
        ['die(xlt("Error"));', 'echo xlt("Error");'],
        ['$session = SessionWrapperFactory::getInstance()->getActiveSession();', '$session = null;'],
        ['sqlQuery("select * from `users` WHERE `id` = ?", [$_GET["user_id"]]);', 'sqlQuery("select * from `users`");'],
        ['sqlQuery("select * from `facility` where `id` = ?", [$_GET["fac_id"]]);', 'sqlQuery("select * from `facility` where `id` = ?", [$_GET["user_id"]]);'],
        [`"WHERE form_id = 'FACUSR' AND uor > 0 AND field_id != '' "`, `"WHERE form_id = 'FACUSR' AND field_id != '' "`],
        ['"WHERE `uid` = ? AND `facility_id` = ? AND `field_id` = ?"', '"WHERE `uid` = ? AND `field_id` = ?"'],
        ['value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>"', 'value=""'],
        ['<input type=hidden name=mode value="facility_user_id">', '<input type=hidden name=mode value="facility_user">'],
        ['value="<?php echo attr($_GET["user_id"]); ?>"', 'value="<?php echo $_GET["user_id"]; ?>"'],
        ['name=fac_id value="<?php echo attr($_GET["fac_id"]); ?>"', 'name=facility_id value="<?php echo attr($_GET["fac_id"]); ?>"'],
        ["generate_form_field($layout_entry, ($entry_data['field_value'] ?? ''));", "generate_display_field($layout_entry, ($entry_data['field_value'] ?? ''));"],
        ["<?php echo text($user_info['username']); ?>", "<?php echo $user_info['username']; ?>"],
        ["<?php echo text($fac_info['name']); ?>", "<?php echo $fac_info['name']; ?>"],
        ["text(xl_layout_label($layout_entry['title']))", "xl_layout_label($layout_entry['title'])"],
        ["<form name='form_facility_user' id='form_facility_user' method='post' action=\"facility_user.php\">", "<form name='form_facility_user' id='form_facility_user' method='get' action=\"facility_user.php\">"],
        ['<button type="submit" class="btn btn-secondary btn-save"', '<button type="button" class="btn btn-secondary btn-save"'],
        ["<a class=\"btn btn-link btn-cancel\" id='cancel' href='#'>", "<a class=\"btn btn-link btn-cancel\" id='close' href='#'>"],
        ['top.restoreSession();\n', ''],
        ["dlgclose('refreshme', false);", 'dlgclose();'],
        ['theme: "bootstrap4",', 'theme: "classic",'],
        ["<?php require(OEGlobalsBag::getInstance()->getSrcDir() . '/js/xl/select2.js.php'); ?>", ''],
        ["$('.datepicker').datetimepicker({", "$('.datepicker').select2({"],
        ["$('.datetimepicker-future').datetimepicker({", "$('.datetimepicker-futures').datetimepicker({"],
        ['<?php require OEGlobalsBag::getInstance()->getProjectDir() . "/library/options_listadd.inc.php"; ?>', ''],
        ["<?php echo $date_init ?? ''; ?>", ''],
        ["Header::setupHeader(['common', 'datetime-picker', 'opener', 'select2'])", "Header::setupHeader(['common', 'datetime-picker', 'select2'])"],
        ['<table class="table table-borderless ">', '<table class="table">'],
        ['<td style="width:180px;">', '<td style="width:240px;">'],
        ['<div class="page-title">', '<div class="page-title oe-extra">'],
    ];
    for (const [from, to] of mutations) {
        expect(from).not.toBe(to);
        for (const base of [fixture, apply(fixture)]) {
            expect(count(base, from)).toBe(1);
            const mutated = base.replace(from, () => to);
            expect(mutated).not.toBe(base);
            expect(accepted(mutated)).toBe(false);
            expect(restore(mutated)).not.toBe(fixture);
        }
    }
});

test('the caller and save backend keep their ACL, CSRF, FACUSR scope, SQL and 550x550 iframe launcher', () => {
    const caller = read('interface/usergroup/facility_user.php');
    for (const anchor of [
        "if (!AclMain::aclCheckCore('admin', 'users')) {",
        'if (!empty($_POST)) {\n    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);\n}',
        'if (isset($_POST["mode"]) && $_POST["mode"] == "facility_user_id" && isset($_POST["user_id"]) && isset($_POST["fac_id"])) {',
        '"WHERE `form_id` = \'FACUSR\' AND `uor` > 0 AND `field_id` != \'\' "',
        'sqlStatement("INSERT INTO `facility_user_ids` (`uid`, `facility_id`, `field_id`, `field_value`) VALUES (?,?,?,?)", [$_POST["user_id"], $_POST["fac_id"], $frow[\'field_id\'], $value]);',
        'sqlStatement("UPDATE `facility_user_ids` SET `field_value` = ? WHERE `id` = ?", [$value, $entry_id[\'id\']]);',
        'function refreshme() {\n            top.restoreSession();\n            document.location.reload();\n        }',
        "dlgopen('', '', 550, 550, '', '', {\n                    //onClosed: 'refreshme',\n                    sizeHeight: 'auto',\n                    allowResize: true,\n                    allowDrag: true,\n                    dialogId: '',\n                    type: 'iframe',\n                    url: $(this).attr('href')\n                });",
        'href="facility_user_admin.php?user_id=<?php echo attr_url($user[\'id\']); ?>&fac_id=<?php echo attr_url($facility[\'id\']); ?>" class="small_modal"',
    ]) expect(count(caller, anchor)).toBe(1);
    expect(caller).not.toMatch(/facility-user-popup|ClinicalWorkspaceAssets/);
    expect(count(caller, '<body>')).toBe(1);
});

// The helper's complete basename list on origin/master, in order.
const originalAssets = [
    'ajtooltip.js', 'appointment.css', 'calendar-sidebar.js', 'calendar-workday.css', 'calendar-workday.js',
    'encounter-document.css', 'finder.css', 'global-messages.css', 'history-document.css', 'history-editor.css',
    'issue-popup.css', 'lbf-document.css', 'mode.js', 'patient-messages.css', 'patient-picker-popup.css',
    'patient-results-popup.css', 'patient-search.css', 'soap-document.css', 'soap-document.js',
    'soap-reference.css', 'soap-reference.js', 'visit-history.css', 'visit-history.js', 'workspace.css',
];
const assetLine = "        'facility-user-popup.css',\n";
const supported = php => {
    const block = php.match(/private const SUPPORTED = \[\n([\s\S]*?)\n {4}\];/);
    if (!block) return null;
    const lines = block[1].split('\n');
    return lines.every(line => /^ {8}'[^']+',$/.test(line)) ? lines.map(line => line.trim().slice(1, -2)) : null;
};

test('helper inverse: removing only the single registration restores the original asset list', () => {
    const helper = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
    expect(count(helper, assetLine)).toBeLessThanOrEqual(1);
    expect(supported(helper.replace(assetLine, ''))).toEqual(originalAssets);
    expect(count(helper, 'if (!in_array($asset, self::SUPPORTED, true)) {')).toBe(1);
});

test('desired presentation: the helper registers the sheet once, in sorted position', () => {
    const helper = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
    expect(count(helper, assetLine)).toBe(1);
    const expected = [...originalAssets];
    expected.splice(expected.indexOf('finder.css'), 0, 'facility-user-popup.css');
    expect(supported(helper)).toEqual(expected);
});

// ---- Sheet contract: parsed declarations and selector scoping, not a cascade simulation. ----
const scope = 'body.oe-workbench-context.oe-facility-user-popup';
const doc = '.oe-facility-user-document';
const allowed = new Set(['color', 'background-color', 'opacity', 'outline', 'outline-color', 'outline-style', 'outline-width', 'outline-offset']);
const rules = text => {
    const out = [];
    postcss.parse(text).walkRules(rule => out.push({
        selectors: rule.selectors.map(s => s.replace(/\s+/g, ' ').trim()),
        decls: rule.nodes.filter(n => n.type === 'decl').map(d => ({
            prop: d.prop.toLowerCase(), value: d.value.trim(), important: d.important || /!important/i.test(d.value),
        })),
    }));
    return out;
};
// 'focus' for plain :focus (including :focus:not(:focus-visible)), 'visible' for :focus-visible only.
const focusKind = s => (/:focus(?![\w-])/.test(s) ? 'focus' : /:focus-visible/.test(s) ? 'visible' : null);
const touchesButton = s => /\.btn|button|#form_save|#cancel(?![\w-])/.test(s);

const violations = text => {
    const found = [];
    const tree = postcss.parse(text);
    const top = tree.nodes.filter(n => n.type !== 'comment');
    if (top.length && !(top.length === 1 && top[0].type === 'atrule' && top[0].name === 'media' && top[0].params === 'screen')) {
        found.push('sheet must be one @media screen block');
    }
    tree.walkAtRules(at => { if (at !== top[0]) found.push(`nested @${at.name}`); });
    for (const { selectors, decls } of rules(text)) {
        const props = new Set(decls.map(d => d.prop));
        const placeholder = selectors.every(s => s.includes('::placeholder'));
        const kinds = new Set(selectors.map(focusKind));
        if (kinds.has('focus') && kinds.has('visible')) found.push(`grouped :focus/:focus-visible ${selectors}`);
        for (const s of selectors) {
            if (s !== scope) {
                if (!s.startsWith(`${scope} `)) found.push(`unscoped ${s}`);
                else if (!s.slice(scope.length + 1).split(/\s*[\s>+~]\s*/)[0].includes(doc)) found.push(`outside document ${s}`);
            }
            if (/select2|xdsoft|datetimepicker/i.test(s)) found.push(`widget palette ${s}`);
            if (touchesButton(s) && (!focusKind(s) || decls.some(d => !d.prop.startsWith('outline')))) found.push(`button palette ${s}`);
            if (/form-control/.test(s) && !['.is-invalid', '.is-valid', '.was-validated'].every(t => s.includes(t))) {
                found.push(`validation not excluded ${s}`);
            }
        }
        for (const d of decls) {
            if (!allowed.has(d.prop)) found.push(`property ${d.prop}`);
            if (d.important) found.push(`!important ${d.prop}`);
            if (d.prop === 'opacity' && (d.value !== '1' || !placeholder)) found.push('opacity outside opaque placeholder');
            if (d.prop.startsWith('outline') && !selectors.every(focusKind)) found.push(`outline outside focus ${selectors}`);
            if (/^outline(-style|-width)?$/.test(d.prop) && /^(none|0)(\s|$)/.test(d.value)) found.push(`focus stripped ${selectors}`);
        }
        if (props.has('background-color') && !props.has('color')) found.push(`unpaired background ${selectors}`);
        if (props.has('color') && !props.has('background-color') && !placeholder) found.push(`unpaired ink ${selectors}`);
    }
    return found;
};
const hex = value => value.toLowerCase().replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/, '#$1$1$2$2$3$3');
const declsFor = selector => Object.fromEntries(rules(css())
    .filter(r => r.selectors.includes(selector)).flatMap(r => r.decls.map(d => [d.prop, hex(d.value)])));

test('desired sheet: one screen-only block, scoped, paint-only, paired and free of !important', () => {
    const all = rules(css());
    expect(all.length).toBeGreaterThan(0);
    expect(violations(css())).toEqual([]);
    expect(css()).not.toMatch(/workspace\.css|@import/);
    expect(declsFor(scope)).toMatchObject({ 'background-color': '#edf2f3', color: '#182c36' });
    expect(declsFor(`${scope} ${doc}`)).toMatchObject({ 'background-color': '#ffffff', color: '#182c36' });
});

test('sheet negative controls: unrelated selectors, geometry and !important are rejected', () => {
    const tree = postcss.parse(css());
    const media = tree.nodes.find(n => n.type === 'atrule');
    expect(media).toBeDefined();
    const rule = media.nodes.find(n => n.type === 'rule');
    const mutate = edit => { const copy = tree.clone(); edit(copy.nodes.find(n => n.type === 'atrule')); return copy.toString(); };
    const mutants = [
        mutate(m => m.append({ selector: '.table td', nodes: [] }).last.append({ prop: 'color', value: '#000' })),
        mutate(m => m.append({ selector: `${scope} .page-title`, nodes: [] }).last.append({ prop: 'color', value: '#000' })),
        mutate(m => m.nodes.find(n => n.type === 'rule').append({ prop: 'padding', value: '0' })),
        mutate(m => m.nodes.find(n => n.type === 'rule').append({ prop: 'width', value: '100%' })),
        mutate(m => m.nodes.find(n => n.type === 'rule').append({ prop: 'font-size', value: '14px' })),
        mutate(m => { m.nodes.find(n => n.type === 'rule').nodes.find(n => n.type === 'decl').important = true; }),
        mutate(m => m.append({ selector: `${scope} ${doc} .select2-selection`, nodes: [] })),
        `${tree.toString()}\n@media print { ${rule.selector} { color: #000; background-color: #fff; } }`,
    ];
    for (const mutant of mutants) expect(violations(mutant).length).toBeGreaterThan(0);
});

// The real popup markup around the table and fields that generate_form_field() emits.
const mount = () => {
    document.body.className = 'oe-workbench-context oe-facility-user-popup';
    document.body.innerHTML = `<div class="container oe-facility-user-document"><div class="row">
<form name="form_facility_user" id="form_facility_user" method="post" action="facility_user.php">
<table class="table table-borderless "><tr><td id="label">User:</td><td id="cell">
<input type="text" id="input" class="form-control"><select id="select" class="form-control"><option>a</option></select>
<textarea id="textarea" class="form-control"></textarea>
<input type="text" id="input-disabled" class="form-control" disabled><select id="select-disabled" class="form-control" disabled></select>
<textarea id="textarea-disabled" class="form-control" disabled></textarea>
<input type="text" id="input-readonly" class="form-control" readonly><textarea id="textarea-readonly" class="form-control" readonly></textarea>
<input type="text" id="input-invalid" class="form-control is-invalid"><input type="text" id="input-valid" class="form-control is-valid">
<button type="submit" class="btn btn-secondary btn-save" id="form_save">Save</button><a class="btn btn-link btn-cancel" id="cancel" href="#">Cancel</a>
</td></tr></table></form>
<form class="was-validated"><input type="text" id="wv-input" class="form-control" required><select id="wv-select" class="form-control"></select>
<textarea id="wv-textarea" class="form-control"></textarea></form></div></div>`;
};
// Rules with a non-pseudo selector the element itself matches. Focus and ::placeholder selectors
// are checked textually below rather than by stripping the pseudo-class. Selector errors propagate.
const matching = el => rules(css()).flatMap(r => r.selectors
    .filter(s => !/::|:focus/.test(s) && el.matches(s)).map(selector => ({ selector, decls: r.decls })));
const paints = hits => hits.some(h => ['color', 'background-color'].every(p => h.decls.some(d => d.prop === p)));

test('desired sheet: table cells and controls carry explicit ink and paper in normal, disabled and readonly states', () => {
    mount();
    for (const id of ['label', 'cell']) expect(paints(matching(document.getElementById(id)))).toBe(true);
    expect(paints(matching(document.querySelector('table.table')))).toBe(true);
    for (const id of ['input', 'select', 'textarea']) expect(paints(matching(document.getElementById(id)))).toBe(true);
    const state = (id, pattern) => paints(matching(document.getElementById(id)).filter(h => pattern.test(h.selector)));
    for (const id of ['input-disabled', 'select-disabled', 'textarea-disabled']) expect(state(id, /:disabled|\[disabled\]/)).toBe(true);
    for (const id of ['input-readonly', 'textarea-readonly']) expect(state(id, /:read-only|\[readonly\]/)).toBe(true);
    const placeholder = rules(css()).filter(r => r.selectors.some(s => /form-control.*::placeholder$/.test(s)));
    expect(placeholder.some(r => r.decls.some(d => d.prop === 'color') && r.decls.some(d => d.prop === 'opacity' && d.value === '1'))).toBe(true);
});

test('desired sheet: validation-state controls and the buttons receive no palette', () => {
    mount();
    expect(rules(css()).length).toBeGreaterThan(0);
    for (const id of ['input-invalid', 'input-valid', 'wv-input', 'wv-select', 'wv-textarea', 'form_save', 'cancel']) {
        expect(matching(document.getElementById(id))).toEqual([]);
    }
});

test('desired sheet: fields, Save and Cancel have separate :focus and :focus-visible outlines', () => {
    const all = rules(css());
    const outlined = (kind, target) => all.some(r => r.selectors.every(s => focusKind(s) === kind)
        && r.selectors.some(s => target.test(s))
        && r.decls.some(d => /^outline(-style|-width|-color)?$/.test(d.prop) && !/^(none|0)(\s|$)/.test(d.value)));
    for (const target of [/form-control/, /\.btn-save|#form_save/, /\.btn-cancel|#cancel(?![\w-])/]) {
        expect(outlined('focus', target)).toBe(true);
        expect(outlined('visible', target)).toBe(true);
    }
});
