/** @jest-environment node */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const ROUTE = 'interface/patient_file/problem_encounter.php';
const LAUNCHER = 'interface/patient_file/summary/stats_full.php';
const NESTED = 'interface/patient_file/summary/add_edit_issue.php';
const SHEET = 'interface/clinical-workspace/issues-encounters-document.css';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const css = () => read(SHEET);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const count = (text, part) => text.split(part).length - 1;

// sha256 of problem_encounter.php at master 18647270, before the workbench presentation edits.
const BASELINE = '69a68e837f710a46ce1537e52cc08faea9e507c19c0dde63b7fbde2cb16c6c3c';

const link = '    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n'
    + '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/issues-encounters-document.css?v=<?php echo attr_url($clinicalAssets->version(\'issues-encounters-document.css\')); ?>">\n';

// The complete presentation edit map, each entry [original, presented]: one use line, one
// versioned screen link, and route/document/layout/identity/sections/actions/instructions
// classes added to existing elements. Nothing else in the route may differ from master.
const changes = [
    ['\nuse OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;\n',
        '\nuse OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;\n'],
    ["    <?php Header::setupHeader(['opener', 'topdialog', 'dialog']); ?>\n",
        `    <?php Header::setupHeader(['opener', 'topdialog', 'dialog']); ?>\n${link}`],
    ['<body>\n    <div class="container">\n',
        '<body class="oe-issues-encounters">\n    <div class="container oe-ie-document">\n'],
    ['                <table class="table">\n', '                <table class="table oe-ie-layout">\n'],
    ["<td colspan='2' class=\"text-center font-weight-bold\">", "<td colspan='2' class=\"text-center font-weight-bold oe-ie-identity\">"],
    ['                    <tr>\n                        <td class="text-center align-top p-0 pl-3">',
        '                    <tr class="oe-ie-sections">\n                        <td class="text-center align-top p-0 pl-3 oe-ie-section oe-ie-issues">'],
    ['<td class="text-center align-top p-0 pr-3">', '<td class="text-center align-top p-0 pr-3 oe-ie-section oe-ie-encounters">'],
    ['<div class="btn-group">', '<div class="btn-group oe-ie-actions">'],
    ['        <p>\n            <span class="font-weight-bold"><?php echo xlt(\'Instructions:\'); ?></span>',
        '        <p class="oe-ie-instructions">\n            <span class="font-weight-bold"><?php echo xlt(\'Instructions:\'); ?></span>'],
];

// Undo every presentation edit; null when any edit is missing or ambiguous.
const restore = text => {
    let restored = text;
    for (const [before, after] of changes) {
        if (count(restored, after) !== 1) return null;
        restored = restored.replace(after, () => before);
    }
    return restored;
};

describe('problem_encounter.php carries only the declared presentation edits', () => {
    test('reversing the full edit map restores the exact original route digest', () => {
        const php = read(ROUTE);
        for (const [, after] of changes) expect([after, count(php, after)]).toEqual([after, 1]);
        const restored = restore(php);
        expect(restored).not.toBeNull();
        expect(sha(restored)).toBe(BASELINE);
    });

    test('the route sheet is linked once, screen only, versioned through the helper, after Header and before the inline style', () => {
        const php = read(ROUTE);
        expect(count(php, 'issues-encounters-document.css')).toBe(2);
        expect(count(php, link)).toBe(1);
        expect(php).not.toMatch(/clinical-workspace\/(workspace|popup|mode)\.(css|js)/);
        expect(php).not.toMatch(/setupAssets|mode\.js|workspace\.css/);
        const at = php.indexOf('issues-encounters-document.css');
        expect(at).toBeGreaterThan(php.indexOf('Header::setupHeader('));
        expect(at).toBeLessThan(php.indexOf('tr.head   { font-size:10pt;'));
        // After the POST branch (which exits with its own minimal page) and inside <head>.
        expect(at).toBeGreaterThan(php.indexOf("if (!empty($_POST['form_save'])) {"));
        expect(at).toBeLessThan(php.indexOf('</head>'));
        expect(php).not.toMatch(/media="print"|@media print/);
    });

    test('original ACL, CSRF, session, service, SQL, hidden fields, radios, rows, handlers, colours and text are verbatim', () => {
        const php = read(ROUTE);
        for (const fragment of [
            'require_once("../globals.php");\n',
            '$session = \\OpenEMR\\Common\\Session\\SessionWrapperFactory::getInstance()->getActiveSession();\n',
            '$patdata = getPatientData($pid, "fname,lname,squad");',
            "$thisauth = ((AclMain::aclCheckCore('encounters', 'notes', '', 'write') ||\n            AclMain::aclCheckCore('encounters', 'notes_a', '', 'write')) &&\n            AclMain::aclCheckCore('patients', 'med', '', 'write'));",
            "if ($patdata['squad'] && ! AclMain::aclCheckCore('squads', $patdata['squad'])) {\n     $thisauth = 0;\n}",
            'AccessDeniedHelper::denyWithTemplate("ACL check failed for encounters/notes or patients/med: Issues and Encounters", xl("Issues and Encounters"));',
            "if (!empty($_POST['form_save'])) {\n    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);",
            "$pattern = '|/(\\d+),(\\d+)|';",
            '$patientIssuesService->replacePatientEncounterIssues($pid, $encountersByListId, $session->get(\'authUserID\'));',
            'echo " var myboss = opener ? opener : parent;\\n";\n    echo " myboss.location.reload();\\n";\n    echo " dlgclose();\\n";',
            '$pres = sqlStatement("SELECT * FROM lists WHERE pid = ? " .\n"ORDER BY type, date", [$pid]);',
            '$eres = sqlStatement("SELECT * FROM form_encounter WHERE pid = ? " .\n"ORDER BY date DESC", [$pid]);',
            '$peres = sqlStatement("SELECT * FROM issue_encounter WHERE pid = ?", [$pid]);',
            "    <?php Header::setupHeader(['opener', 'topdialog', 'dialog']); ?>\n",
            "tr.head   { font-size:10pt; background-color:#cccccc; text-align:center; }\ntr.detail { font-size:10pt; background-color:#eeeeee; }",
            "trcolors['U'] = new Array('var(--black)', 'var(--gray200)'); // unselected",
            "trcolors['K'] = new Array('var(--black)', 'var(--yellow)'); // selected key",
            "trcolors['V'] = new Array('var(--black)', 'var(--indigo)'); // selected value",
            "dlgopen('summary/add_edit_issue.php' + tmp, '_blank', 600, 625);",
            "function refreshIssue(issue, title) {\n top.restoreSession();\n location.reload();\n}",
            "<form method='post' action='problem_encounter.php' onsubmit='return top.restoreSession()'>",
            '<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />',
            "echo \"<input type='hidden' name='form_pid' value='\" . attr($pid) . \"' />\\n\";",
            "echo \"<input type='hidden' name='form_pelist' value='/\";",
            'echo attr($row[\'list_id\']) . "," . attr($row[\'encounter\']) . "/";',
            "<input type='radio' name='form_key' value='p' onclick='clearall()' checked />",
            "<input type='radio' name='form_key' value='e' onclick='clearall()' />",
            "echo \"    <tr class='detail' id='p_\" . attr($rowid) . \"' onclick='doclick(\\\"p\\\", \" . attr_js($rowid) . \")'>\\n\";",
            "echo \"    <tr class='detail' id='e_\" . attr($rowid) . \"' onclick='doclick(\\\"e\\\", \" . attr_js($rowid) . \")'>\\n\";",
            '$endjs .= "pselected[" . js_escape($rowid) . "] = \'\';\\n";',
            '$endjs .= "eselected[" . js_escape($rowid) . "] = \'\';\\n";',
            "<?php echo xlt('Issues and Encounters for'); ?> <?php echo text($patdata['fname']) . \" \" . text($patdata['lname']) . \" (\" . text($pid) . \")</b>\\n\"; ?>",
            '<button type="submit" class="btn btn-primary btn-sm btn-save" name=\'form_save\' value=\'<?php echo xla(\'Save\'); ?>\' disabled>',
            '<button type="button" class="btn btn-primary btn-sm btn-add" value=\'<?php echo xla(\'Add Issue\'); ?>\' onclick=\'newIssue()\'>',
            "<button type=\"button\" class='btn btn-secondary btn-sm btn-cancel' onclick='dlgclose()'><?php echo xla('Cancel'); ?></button>",
            "<?php echo xlt('Choose a section and click an item within it; then in the other section you will see the related items highlighted, and you can click in that section to add and delete relationships.'); ?>",
            "if (!empty($_REQUEST['issue'])) {\n    echo \"doclick('p', \" . js_escape($_REQUEST['issue']) . \");\\n\";\n}",
            "alert(<?php echo xlj('You must first select an item in the section whose radio button is checked.') ;?>);",
        ]) {
            expect([fragment, count(php, fragment)]).toEqual([fragment, 1]);
        }
    });

    test('the real stats_full.php launcher and the nested Add Issue popup are byte-identical', () => {
        const launcher = read(LAUNCHER);
        expect(sha(launcher)).toBe('06be3854bda78f35827ea8e41ab9c35f26ed01147afd83dc2fcb2a1bcdf5e526');
        expect(count(launcher, "dlgopen('../problem_encounter.php?issue=' + encodeURIComponent(id), '_blank', 700, 400);")).toBe(1);
        expect(sha(read(NESTED))).toBe('07c610115920aa6fe88b30b2ac966726370873f31e211feb2079a2fe967902e0');
    });
});

test('negative controls: service, ACL, CSRF, SQL, session, handlers, colours or controls cannot change unnoticed', () => {
    const mutations = [
        ["AclMain::aclCheckCore('encounters', 'notes', '', 'write')", "AclMain::aclCheckCore('encounters', 'notes', '', 'view')"],
        ["AclMain::aclCheckCore('patients', 'med', '', 'write')", "AclMain::aclCheckCore('patients', 'med')"],
        ["! AclMain::aclCheckCore('squads', $patdata['squad'])", "false"],
        ['if (!$thisauth) {', 'if (false) {'],
        ['CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', ''],
        ['name="csrf_token_form"', 'name="csrf_token"'],
        ["$pattern = '|/(\\d+),(\\d+)|';", "$pattern = '|/(\\d+),(\\d+),([YN])|';"],
        ['$patientIssuesService->replacePatientEncounterIssues($pid,', '$patientIssuesService->replacePatientEncounterIssues($form_pid,'],
        ["$session->get('authUserID'));\n", "$session->get('authUser'));\n"],
        ['myboss.location.reload();', 'myboss.refreshIssue();'],
        ['"SELECT * FROM lists WHERE pid = ? "', '"SELECT * FROM lists WHERE pid = ? AND activity = 1 "'],
        ['"ORDER BY date DESC", [$pid]', '"ORDER BY date ASC", [$pid]'],
        ['SELECT * FROM issue_encounter WHERE pid = ?', 'SELECT * FROM issue_encounter'],
        ["Header::setupHeader(['opener', 'topdialog', 'dialog'])", "Header::setupHeader(['opener', 'dialog'])"],
        ['tr.detail { font-size:10pt; background-color:#eeeeee; }', 'tr.detail { font-size:10pt; }'],
        ["'var(--yellow)'", "'var(--warning)'"],
        ["'var(--indigo)'", "'var(--primary)'"],
        ["'var(--gray200)'", "'transparent'"],
        ["(keyid && f.form_key[1].checked)", "(keyid && f.form_key[0].checked)"],
        ["'summary/add_edit_issue.php' + tmp, '_blank', 600, 625", "'summary/add_edit_issue.php' + tmp, '_blank', 700, 625"],
        ["var frag = '/' + problem + ',' + encounter + '/';\n var i = pelist.value.indexOf(frag);\n if (i < 0) return '';", "var frag = '/' + problem + ',' + encounter;\n var i = pelist.value.indexOf(frag);\n if (i < 0) return '';"],
        ['pelist.value.substring(i + frag.length - 1);', 'pelist.value.substring(i + frag.length);'],
        ["pelist.value += '' + problem + ',' + encounter + '/';\n document.forms[0].form_save.disabled = false;", "pelist.value += '' + problem + ',' + encounter + '/';"],
        ['var piskey = document.forms[0].form_key[0].checked;', 'var piskey = true;'],
        ["   alert(<?php echo xlj(", "   console.log(<?php echo xlj("],
        ["onsubmit='return top.restoreSession()'", "onsubmit='return true'"],
        ["action='problem_encounter.php'", "action='#'"],
        ["name='form_key' value='p' onclick='clearall()' checked", "name='form_key' value='p' onclick='clearall()'"],
        ["<input type='radio' name='form_key' value='e' onclick='clearall()' />", "<input type='radio' name='form_key' value='e' />"],
        ["id='p_\" . attr($rowid)", "id='issue_\" . attr($rowid)"],
        ["value='<?php echo xla('Save'); ?>' disabled>", "value='<?php echo xla('Save'); ?>'>"],
        ["onclick='newIssue()'", "onclick='dlgclose()'"],
        ["class='btn btn-secondary btn-sm btn-cancel' onclick='dlgclose()'", "class='btn btn-secondary btn-sm btn-cancel' onclick='window.close()'"],
        ["echo \"doclick('p', \" . js_escape($_REQUEST['issue']) . \");\\n\";", "echo \"doclick('e', \" . js_escape($_REQUEST['issue']) . \");\\n\";"],
        ['you can click in that section to add and delete relationships.', 'you can click to add relationships.'],
    ];
    const php = read(ROUTE);
    for (const [from, to] of mutations) {
        expect([from, count(php, from)]).toEqual([from, 1]);
        const restored = restore(php.replace(from, () => to));
        expect([from, restored === null ? null : sha(restored)]).not.toEqual([from, BASELINE]);
    }
    expect(restore(php.replace(' oe-ie-encounters', ''))).toBeNull();
    expect(restore(php.replace('<body class="oe-issues-encounters">', '<body>'))).toBeNull();
    expect(sha(restore(php.replace("class='btn btn-secondary btn-sm btn-cancel'", "class='btn btn-secondary btn-cancel'")))).not.toBe(BASELINE);
});

test('the asset helper allowlists exactly the new basename, in order, and the complete list is otherwise unchanged', () => {
    const helper = read(HELPER);
    const list = helper.match(/private const SUPPORTED = \[\n([\s\S]*?)\n {4}\];/)[1]
        .split('\n').map(line => line.trim().replace(/^'|',$/g, ''));
    expect(list).toEqual([
        'ajtooltip.js', 'appointment.css', 'calendar-sidebar.js', 'calendar-workday.css', 'calendar-workday.js',
        'encounter-document.css', 'finder.css', 'global-messages.css', 'history-document.css', 'history-editor.css',
        'issue-popup.css', 'issues-encounters-document.css', 'lbf-document.css', 'mode.js', 'patient-messages.css',
        'patient-picker-popup.css', 'patient-results-popup.css', 'patient-search.css', 'soap-document.css',
        'soap-document.js', 'soap-reference.css', 'soap-reference.js', 'visit-history.css', 'visit-history.js', 'workspace.css',
    ]);
    expect(count(helper, 'issues-encounters')).toBe(1);
});

// --- The original row/radio/save algorithms, executed unchanged in a real DOM ---------------------

const routeScript = () => {
    const php = read(ROUTE);
    const start = php.indexOf('// These are the possible colors for table rows.');
    const end = php.indexOf('</script>', start);
    const js = php.slice(start, end)
        .replace('<?php require($srcdir . "/restoreSession.php"); ?>', '')
        .replace(/<\?php echo xlj\('([^']*)'\) ;\?>/g, (_, text) => JSON.stringify(text));
    expect(js).not.toContain('<?php');
    return js;
};
const fromRoute = pattern => read(ROUTE).match(pattern)[0];

// Synthetic patient: issues 1 and 2, encounters 10 and 11, one stored link 1<->10.
const page = (pelist = '/1,10/') => {
    const radios = [/<input type='radio' name='form_key' value='p'[^>]*>/, /<input type='radio' name='form_key' value='e'[^>]*>/].map(fromRoute);
    const save = fromRoute(/<button type="submit" class="btn btn-primary btn-sm btn-save"[^\n]* disabled>/).replace(/<\?php echo xla\('Save'\); \?>/, 'Save');
    const row = (pfx, id) => `<tr class='detail' id='${pfx}_${id}' onclick='doclick("${pfx}", "${id}")'><td>${pfx}${id}</td></tr>`;
    const markup = `${fromRoute(/<form method='post' action='problem_encounter\.php'[^>]*>/)}`
        + `<input type='hidden' name='form_pelist' value='${pelist}' />`
        + `<table><tr class='head'><td>${radios[0]}</td></tr>${row('p', 1)}${row('p', 2)}</table>`
        + `<table><tr class='head'><td>${radios[1]}</td></tr>${row('e', 10)}${row('e', 11)}</table>`
        + `${save}Save</button></form>`;
    const { window } = new JSDOM(markup, { runScripts: 'dangerously' });
    const alerts = [];
    window.alert = message => { alerts.push(message); };
    window.eval(routeScript());
    // The route's generated $endjs for these rows.
    window.eval("pselected['1'] = '';\npselected['2'] = '';\neselected['10'] = '';\neselected['11'] = '';\n");
    const doc = window.document;
    // jsdom has no named form-control properties; the browser's form.form_x is elements.namedItem.
    for (const name of ['form_save', 'form_pelist', 'form_key']) {
        Object.defineProperty(doc.forms[0], name, { get: () => doc.forms[0].elements.namedItem(name) });
    }
    const paint = id => doc.getElementById(id).getAttribute('style') ?? '';
    const click = id => doc.getElementById(id).click();
    return { window, doc, alerts, paint, click, form: doc.forms[0] };
};

describe('original doclick/addPair/removePair/clearall run unchanged', () => {
    test('Save starts disabled; a value click before choosing a key alerts and changes nothing', () => {
        const { alerts, click, form, paint } = page();
        expect(form.form_save.disabled).toBe(true);
        click('e_10');
        expect(alerts).toEqual(['You must first select an item in the section whose radio button is checked.']);
        expect(form.form_pelist.value).toBe('/1,10/');
        expect(form.form_save.disabled).toBe(true);
        expect(paint('e_10')).toBe('');
    });

    test('Issues mode: key is inline yellow, linked encounter inline indigo, unlinked untouched; link and unlink enable Save', () => {
        const { click, form, paint, alerts } = page();
        click('p_1');
        expect(paint('p_1')).toMatch(/background-color: var\(--yellow\)/);
        expect(paint('e_10')).toMatch(/background-color: var\(--indigo\)/);
        expect(paint('e_11')).toBe('');
        expect(form.form_save.disabled).toBe(true);
        click('e_11');
        expect(paint('e_11')).toMatch(/background-color: var\(--indigo\)/);
        expect(form.form_pelist.value).toBe('/1,10/1,11/');
        expect(form.form_save.disabled).toBe(false);
        click('e_10');
        expect(paint('e_10')).toMatch(/background-color: var\(--gray200\)/);
        expect(form.form_pelist.value).toBe('/1,11/');
        expect(alerts).toEqual([]);
    });

    test('Encounters mode: the original radio onclick clears, the encounter becomes key and its issue is highlighted', () => {
        const { click, form, paint } = page();
        click('p_1');
        form.form_key[1].click();
        expect(form.form_key[1].checked).toBe(true);
        expect(paint('p_1')).toMatch(/background-color: var\(--gray200\)/);
        expect(paint('e_10')).toMatch(/background-color: var\(--gray200\)/);
        click('e_10');
        expect(paint('e_10')).toMatch(/background-color: var\(--yellow\)/);
        expect(paint('p_1')).toMatch(/background-color: var\(--indigo\)/);
        expect(paint('p_2')).toBe('');
        click('p_2');
        expect(form.form_pelist.value).toBe('/1,10/2,10/');
        expect(form.form_save.disabled).toBe(false);
        click('e_10');
        expect(paint('e_10')).toMatch(/background-color: var\(--gray200\)/);
        expect(paint('p_2')).toMatch(/background-color: var\(--gray200\)/);
    });
});

// --- Route stylesheet ----------------------------------------------------------------------------

const SCOPE = 'html.oe-workbench-context body.oe-issues-encounters';
const at = part => `${SCOPE} ${part}`;
const rules = () => {
    const out = [];
    postcss.parse(css()).walkRules(rule => {
        const decls = {};
        rule.walkDecls(d => { decls[d.prop] = `${d.value}${d.important ? ' !important' : ''}`; });
        out.push({ selectors: rule.selectors, decls });
    });
    return out;
};
const declsFor = selector => Object.assign({}, ...rules().filter(r => r.selectors.includes(selector)).map(r => r.decls));

test('the sheet is one @media screen block, positive-scoped to the context marker and the route body, no !important', () => {
    const tree = postcss.parse(css());
    const top = tree.nodes.filter(node => node.type !== 'comment');
    expect(top).toHaveLength(1);
    expect(top[0].type === 'atrule' && top[0].name === 'media' && top[0].params).toBe('screen');
    const media = [];
    tree.walkAtRules(rule => media.push(`${rule.name} ${rule.params}`));
    expect(media).toEqual(['media screen']);
    expect(rules().length).toBeGreaterThan(10);
    for (const { selectors, decls } of rules()) {
        for (const selector of selectors) {
            expect(selector === SCOPE || selector.startsWith(`${SCOPE} `)).toBe(true);
            expect(selector).not.toMatch(/oe-clinical-workspace|workbench-active|oe-workbench-popup|print|\.modal|\[style|#[pe]_/);
        }
        for (const value of Object.values(decls)) expect(value).not.toMatch(/!important/);
    }
});

test('typography is inherited and nothing is hidden, clipped, shrunk or reordered; logical properties only', () => {
    for (const { decls } of rules()) {
        for (const prop of ['font', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'zoom', 'transform']) {
            expect(decls[prop]).toBeUndefined();
        }
        expect(decls.display ?? '').not.toMatch(/none|contents|grid/);
        expect(decls.visibility).toBeUndefined();
        expect(decls.order).toBeUndefined();
        expect(decls.position ?? '').not.toMatch(/fixed|absolute|sticky/);
        expect(decls['text-overflow']).toBeUndefined();
        expect(decls['white-space'] ?? 'normal').toBe('normal');
        expect(decls.overflow ?? '').not.toMatch(/hidden|clip/);
        expect(decls['overflow-x'] ?? '').not.toMatch(/hidden|clip/);
        expect(decls.height).toBeUndefined();
        expect(decls['max-height']).toBeUndefined();
        expect(decls['min-width'] ?? '0').toBe('0');
        for (const prop of Object.keys(decls)) {
            expect(prop).not.toMatch(/(^|-)(left|right|top|bottom)($|-)/);
            expect(prop).not.toBe('float');
        }
    }
    expect(css()).not.toMatch(/pointer-events|user-select|opacity|content:|clip-path|cursor/);
});

// The real presented markup, rendered as the route emits it for one issue and one encounter.
const presentedDom = () => {
    const { window } = new JSDOM('<!DOCTYPE html><html class="oe-workbench-context oe-workbench-popup"><body class="oe-issues-encounters">'
        + '<div class="container oe-ie-document"><form><div class="table-responsive"><table class="table oe-ie-layout"><tbody>'
        + "<tr><td colspan='2' class=\"text-center font-weight-bold oe-ie-identity\">Issues and Encounters for A B (1)</td></tr>"
        + '<tr class="oe-ie-sections"><td class="text-center align-top p-0 pl-3 oe-ie-section oe-ie-issues"><div class="table-responsive"><table class="table table-sm"><tbody>'
        + "<tr class='head'><td colspan='3' class=\"text-center\"><input type='radio' name='form_key' value='p' checked /><span class=\"font-weight-bold\">Issues Section</span></td></tr>"
        + "<tr class='head'><td>Type</td><td>Title</td><td>Description</td></tr>"
        + "<tr class='detail' id='p_1'><td class='align-top'>t</td><td class='align-top'>x</td><td class='align-top'>d</td></tr>"
        + '</tbody></table></div></td><td class="text-center align-top p-0 pr-3 oe-ie-section oe-ie-encounters"><div class="table-responsive"><table class="table table-sm"><tbody>'
        + "<tr class='head'><td colspan='2' class=\"text-center\"><input type='radio' name='form_key' value='e' /><span class=\"font-weight-bold\">Encounters Section</span></td></tr>"
        + "<tr class='head'><td>Date</td><td>Presenting Complaint</td></tr>"
        + "<tr class='detail' id='e_10'><td class='align-top'>2000-01-01</td><td class='align-top'>r</td></tr>"
        + '</tbody></table></div></td></tr>'
        + '<tr><td colspan=\'2\' class="text-center"><div class="btn-group oe-ie-actions"><button type="submit" class="btn btn-primary btn-sm btn-save" disabled>Save</button>'
        + '<button type="button" class="btn btn-primary btn-sm btn-add">Add Issue</button><button type="button" class="btn btn-secondary btn-sm btn-cancel">Cancel</button></div></td></tr>'
        + '</tbody></table></div></form><p class="oe-ie-instructions"><span class="font-weight-bold">Instructions:</span> text</p></div></body></html>');
    return window.document;
};

test('dynamic yellow/indigo/gray selection paint is never overridden: no rule paints a selection row, its cells or the head rows', () => {
    const doc = presentedDom();
    const painting = /^(color|background|background-color|background-image|border-color|box-shadow|opacity|filter|mix-blend-mode)$/;
    const guarded = [...doc.querySelectorAll('tr.detail, tr.detail *, tr.head, tr.head > td')];
    expect(guarded.length).toBeGreaterThan(10);
    for (const { selectors, decls } of rules()) {
        if (!Object.keys(decls).some(prop => painting.test(prop))) continue;
        for (const selector of selectors) {
            for (const el of guarded) expect([selector, el.outerHTML.slice(0, 40), el.matches(selector)]).toEqual([selector, el.outerHTML.slice(0, 40), false]);
        }
    }
    expect(css()).not.toMatch(/\.detail|\.head|\btr\b[^.]*\{[^}]*(color|background)/);
});

test('document shape: canvas body, paper sheet, two visibly distinct framed sections that stack and scroll independently', () => {
    expect(declsFor(SCOPE)).toMatchObject({ margin: '0', color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-canvas)' });
    expect(declsFor(at('.oe-ie-document'))).toMatchObject({
        color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)', border: '1px solid var(--oe-wb-line)',
        'border-radius': expect.any(String), 'padding-inline': expect.stringMatching(/rem$/),
    });
    expect(declsFor(at('.oe-ie-identity'))).toMatchObject({ color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)', 'overflow-wrap': 'anywhere' });
    expect(declsFor(at('.oe-ie-layout > tbody > tr.oe-ie-sections'))).toMatchObject({ display: 'flex', 'flex-wrap': 'wrap', gap: expect.any(String) });
    expect(declsFor(at('.oe-ie-section'))).toMatchObject({ flex: expect.stringMatching(/^1 1 \d+(\.\d+)?rem$/), 'min-width': '0' });
    const frame = declsFor(at('.oe-ie-section > .table-responsive'));
    expect(frame).toMatchObject({ 'overflow-x': 'auto', 'max-width': '100%', border: '1px solid var(--oe-wb-line)', background: 'var(--oe-wb-paper)', color: 'var(--oe-wb-ink)' });
    const issues = declsFor(at('.oe-ie-issues > .table-responsive'))['border-block-start'];
    const encounters = declsFor(at('.oe-ie-encounters > .table-responsive'))['border-block-start'];
    expect(issues).toMatch(/^3px solid var\(--oe-wb-[a-z-]+\)$/);
    expect(encounters).toMatch(/^3px solid var\(--oe-wb-[a-z-]+\)$/);
    expect(issues).not.toBe(encounters);
    expect(declsFor(at('.oe-ie-instructions'))).toMatchObject({ color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)', 'overflow-wrap': 'anywhere' });
    // The flex row out-specifies the generic layout row reset so stacking actually happens.
    const doc = presentedDom();
    const sections = doc.querySelector('tr.oe-ie-sections');
    expect(sections.matches(at('.oe-ie-layout > tbody > tr.oe-ie-sections'))).toBe(true);
    expect(doc.querySelectorAll('.oe-ie-section > .table-responsive')).toHaveLength(2);
});

const tokens = (() => {
    const out = {};
    postcss.parse(read('interface/clinical-workspace/popup.css')).walkRules(rule => {
        if (!rule.selectors.includes('html.oe-workbench-context')) return;
        rule.walkDecls(d => { if (d.prop.startsWith('--oe-wb-')) out[d.prop] = d.value; });
    });
    return out;
})();
const luminance = hex => {
    const full = hex.length === 4 ? `#${[...hex.slice(1)].map(c => c + c).join('')}` : hex;
    const [r, g, b] = [1, 3, 5].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
        .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};
const tokenValue = value => tokens[value.match(/^var\((--oe-wb-[a-z-]+)\)$/)[1]];

test('every painted surface pairs fixed ink with a surface at 4.5:1 from popup.css tokens; no raw colours', () => {
    for (const { selectors, decls } of rules()) {
        const hasInk = 'color' in decls;
        const hasSurface = 'background' in decls || 'background-color' in decls;
        expect([selectors[0], hasInk]).toEqual([selectors[0], hasSurface]);
        if (!hasInk) continue;
        expect([selectors[0], contrast(tokenValue(decls.color), tokenValue(decls.background ?? decls['background-color'])) >= 4.5]).toEqual([selectors[0], true]);
    }
    for (const { decls } of rules()) {
        for (const value of Object.values(decls)) expect(value).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(|\b(white|black|red|yellow|indigo)\b|var\(--(yellow|indigo|gray200|black)\)/i);
    }
    for (const used of css().match(/--oe-wb-[a-z-]+/g)) {
        expect(['--oe-wb-ink', '--oe-wb-muted', '--oe-wb-canvas', '--oe-wb-paper', '--oe-wb-petrol', '--oe-wb-line']).toContain(used);
    }
});

test('focus stays visible: separate :focus fallback and :focus-visible rules for radios and actions', () => {
    for (const target of ["input[type='radio']", '.oe-ie-actions > .btn']) {
        for (const state of [':focus', ':focus-visible']) {
            const selector = at(`${target}${state}`);
            expect(declsFor(selector)).toMatchObject({ outline: '2px solid var(--oe-wb-petrol)', 'outline-offset': expect.any(String) });
            const owners = rules().filter(r => r.selectors.includes(selector));
            expect(owners.map(r => r.selectors)).toEqual([[selector]]);
        }
    }
    for (const { selectors } of rules()) {
        if (selectors.some(s => s.includes(':focus'))) expect(selectors).toHaveLength(1);
    }
    expect(css()).not.toMatch(/outline:\s*(0|none)|outline-color:\s*transparent/);
});

test('jsdom: rules only match under the context marker plus the route body', () => {
    const { document } = new JSDOM('').window;
    const selectors = rules().flatMap(r => r.selectors).filter(s => s.endsWith('.oe-ie-document'));
    const matches = (htmlClass, bodyClass) => {
        document.documentElement.className = htmlClass;
        document.body.className = bodyClass;
        document.body.innerHTML = '<div class="container oe-ie-document"></div>';
        return selectors.some(s => document.querySelector('.oe-ie-document').matches(s));
    };
    expect(matches('oe-workbench-context oe-workbench-popup', 'oe-issues-encounters')).toBe(true);
    expect(matches('oe-workbench-popup', 'oe-issues-encounters')).toBe(false);
    expect(matches('', 'oe-issues-encounters')).toBe(false);
    expect(matches('oe-workbench-context', '')).toBe(false);
});

describe('route sheet follows the real production popup.js context', () => {
    const ORIGIN = 'https://emr.test';
    const makeWindow = (markup, { url = `${ORIGIN}/interface/patient_file/problem_encounter.php?issue=1`, parent, opener, frameElement } = {}) => {
        const { window } = new JSDOM(markup, { url, runScripts: 'outside-only' });
        if (parent) Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });
        if (frameElement) Object.defineProperty(window, 'frameElement', { configurable: true, get: () => frameElement });
        if (opener) window.opener = opener;
        return window;
    };
    const makeShell = () => makeWindow(
        '<body class="workbench-active"><div id="mainBox"><button type="button" data-workbench-mode></button></div>'
        + '<div class="modal fade dialogModal"><div class="modal-dialog"><div class="modal-content">'
        + '<iframe class="modalIframe"></iframe></div></div></div></body>',
        { url: `${ORIGIN}/interface/main/tabs/main.php` },
    );
    const route = '<body class="oe-issues-encounters"><div class="container oe-ie-document"></div></body>';
    const controller = win => {
        jest.resetModules();
        return require('../../interface/clinical-workspace/popup.js').createPopupController({ win });
    };
    const engaged = win => {
        const sheet = win.document.querySelector('.oe-ie-document');
        return rules().flatMap(r => r.selectors).filter(s => s.endsWith(' .oe-ie-document')).some(s => sheet.matches(s));
    };
    const flush = () => new Promise(resolve => setTimeout(resolve, 0));

    test('the dlgopen frame of an active workbench engages the sheet; legacy mode removes and restores it', async () => {
        const shell = makeShell();
        const win = makeWindow(route, { parent: shell, frameElement: shell.document.querySelector('iframe.modalIframe') });
        expect(controller(win).active).toBe(true);
        expect(engaged(win)).toBe(true);
        shell.document.body.classList.remove('workbench-active');
        await flush();
        expect(engaged(win)).toBe(false);
        shell.document.body.classList.add('workbench-active');
        await flush();
        expect(engaged(win)).toBe(true);
    });

    test('an inactive shell, a standalone window and a non-workbench opener stay legacy', () => {
        const inactive = makeShell();
        inactive.document.body.classList.remove('workbench-active');
        const dialogWin = makeWindow(route, { parent: inactive, frameElement: inactive.document.querySelector('iframe.modalIframe') });
        expect(controller(dialogWin).active).toBe(false);
        expect(engaged(dialogWin)).toBe(false);
        const standalone = makeWindow(route);
        controller(standalone);
        expect(engaged(standalone)).toBe(false);
        const opened = makeWindow(route, { opener: makeWindow('<body></body>') });
        controller(opened);
        expect(engaged(opened)).toBe(false);
    });
});

// Declared-box estimate (16px rem), not a browser layout measurement.
describe.each([146, 180])('narrow %ipx frame: declared-box estimate', width => {
    const px = value => {
        if (value === '0' || value === 'auto') return 0;
        const m = String(value).match(/^(\d*\.?\d+)(px|rem)$/);
        expect(m).not.toBeNull();
        return Number(m[1]) * (m[2] === 'rem' ? 16 : 1);
    };

    test('sections stack below their basis; Save, Add Issue and Cancel wrap at unchanged type size and break long labels', () => {
        const body = declsFor(SCOPE);
        const sheet = declsFor(at('.oe-ie-document'));
        const inner = width - 2 * px(body.margin) - 2 * px(sheet['margin-inline'] ?? '0')
            - 2 * px(sheet['padding-inline']) - 2 * px(sheet.border.split(' ')[0]);
        expect(inner).toBeGreaterThanOrEqual(100);
        const basis = px(declsFor(at('.oe-ie-section')).flex.split(' ')[2]);
        // Two sections side by side need 2 * basis; any frame narrower stacks them.
        expect(2 * basis).toBeGreaterThan(inner);
        expect(declsFor(at('.oe-ie-actions'))).toMatchObject({ 'flex-wrap': 'wrap', 'max-width': '100%', gap: expect.any(String) });
        const button = declsFor(at('.oe-ie-actions > .btn'));
        expect(button).toMatchObject({ 'max-width': '100%', 'white-space': 'normal', 'overflow-wrap': 'anywhere' });
        for (const prop of ['font-size', 'width', 'padding', 'display']) expect(button[prop]).toBeUndefined();
        // The btn-sm class stays on every action: no further shrink is introduced or removed.
        expect(count(read(ROUTE), 'btn-sm')).toBe(3);
    });
});
