/** @jest-environment jsdom */

/*
 * OPEMR-5: deletion confirmation popup as a document-shaped sheet inside an active workbench.
 *
 * Tests-first slice. Before implementation the intended RED is limited to the planned
 * presentation (route additions, helper registration and the new screen sheet). The fixture,
 * inverse, negative-mutation, protected-behaviour and caller tests pass both before and after
 * implementation. A missing stylesheet fails each CSS test with an ordinary assertion.
 *
 * These are source/cascade checks only, not native contrast, layout, compiled-theme or
 * clinical acceptance; see docs/clinical-ui/DELETER-POPUP.md.
 */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readOptional = file => {
    try {
        return read(file);
    } catch {
        return null;
    }
};

const ROUTE = 'interface/patient_file/deleter.php';
const FIXTURE = 'tests/clinical-ui/fixtures/deleter-original.txt';
const CSS_FILE = 'interface/clinical-workspace/deleter-popup.css';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const CALLER = 'interface/patient_file/summary/demographics.php';
const SCOPES = [
    'html.oe-workbench-context body.oe-deleter-popup',
    'html.oe-workbench-popup body.oe-deleter-popup',
];

const source = () => read(ROUTE);
const fixture = () => read(FIXTURE);
const count = (text, part) => text.split(part).length - 1;

// A missing sheet is a plain assertion failure, never a file-system crash.
const requireCss = () => {
    const text = readOptional(CSS_FILE);
    expect({ file: CSS_FILE, present: text !== null }).toEqual({ file: CSS_FILE, present: true });
    return text;
};

const LINK = '<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/deleter-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'deleter-popup.css\')); ?>">';

// Every planned route edit as [original, presented]: one import, one versioned screen link,
// a body class, a class on the existing container and a class on the existing form.
const changes = [
    ['use OpenEMR\\Common\\Acl\\AclMain;\n', 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n'],
    ["    <?php Header::setupHeader('opener'); ?>\n", `    <?php Header::setupHeader('opener'); ?>\n    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n    ${LINK}\n`],
    ['\n<body>\n    <div class="container mt-3">\n', '\n<body class="oe-deleter-popup">\n    <div class="container mt-3 oe-deleter-document">\n'],
    ['<form method=\'post\' name="deletefrm" action=', '<form method=\'post\' name="deletefrm" class="oe-deleter-form" action='],
];

// Forward: original -> presented. Returns null when an original anchor is missing or repeated.
const apply = text => {
    let out = text;
    for (const [before, after] of changes) {
        if (count(out, before) !== 1) return null;
        out = out.replace(before, () => after);
    }
    return out;
};

// Exact inverse: presented -> original. Returns null when a planned addition is missing or repeated.
const restore = text => {
    let out = text;
    for (const [before, after] of [...changes].reverse()) {
        if (count(out, after) !== 1) return null;
        out = out.replace(after, () => before);
    }
    return out;
};

// Destructive, security and handler behaviour the slice must not touch: [anchor, mutation].
const behaviourMutations = [
    ['if (!empty($_GET)) {', 'if (false) {'],
    ['CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);', ''],
    ['CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', ''],
    ["$documentPid = CurrentRequest::get()->query->getInt('document_pid');", "$documentPid = CurrentRequest::get()->query->getInt('patient');"],
    ["|| !OEGlobalsBag::getInstance()->getBoolean('allow_pat_delete')", ''],
    ["AclMain::aclCheckCore('patients', 'docs_rm')", "AclMain::aclCheckCore('patients', 'docs')"],
    ["AclMain::aclCheckCore('acct', 'disc')", "AclMain::aclCheckCore('acct', 'bill')"],
    ['if (!is_numeric($documentForeignId) || (int) $documentForeignId !== $documentPid) {', 'if (!is_numeric($documentForeignId)) {'],
    ["AccessDeniedHelper::deny('Unauthorized transaction deletion attempt');", ''],
    ['EventAuditLogger::getInstance()->newEvent("delete",', 'EventAuditLogger::getInstance()->newEvent("remove",'],
    ['QueryUtils::sqlStatementThrowException("UPDATE `documents` SET `deleted` = 1 WHERE id = ?", [$document]);', 'QueryUtils::sqlStatementThrowException("DELETE FROM `documents` WHERE id = ?", [$document]);'],
    ['deleter_row_delete("patient_data", "pid = ?", [$patient]);', ''],
    ["if (!empty($_POST['form_submit'])) {", 'if (true) {'],
    ['echo "let message = " . js_escape($info_msg) . ";', 'echo "let message = \'" . $info_msg . "\';'],
    ["echo \" opener.dlgSetCallBack('imdeleted', false);\\n\";", "echo \" opener.dlgSetCallBack('imdeleted', true);\\n\";"],
    ['echo " dlgclose(\'imdeleted\', " . js_escape($encounterid) . ");\\n";', 'echo " dlgclose(\'imdeleted\', " . $encounterid . ");\\n";'],
    ['exit();', ''],
    ['    top.restoreSession();\n    document.deletefrm.submit();', '    document.deletefrm.submit();'],
    ['    dlgclose();\n}', "    dlgclose('imdeleted');\n}"],
    ['&document_pid=<?php echo $documentPid ?>', ''],
    ["<?php echo xlt('Delete Patient, Encounter, Form, Issue, Document, Payment, Billing or Transaction'); ?>", "<?php echo xl('Delete Patient, Encounter, Form, Issue, Document, Payment, Billing or Transaction'); ?>"],
    ['echo text($msg);', 'echo $msg;'],
    ['<button onclick="submit_form()" class="btn btn-sm btn-primary mr-2">', '<button type="button" onclick="submit_form()" class="btn btn-sm btn-primary mr-2">'],
    ['<button type="button" class="btn btn-sm btn-secondary" onclick="popup_close();">', '<button class="btn btn-sm btn-secondary" onclick="popup_close();">'],
    ["<input type='hidden' name='form_submit' value='delete'/>", "<input type='hidden' name='form_submit' value=''/>"],
];

// Edits to the planned presentation itself that the exact inverse must reject.
const presentationMutations = [
    ['media="screen"', 'media="all"'],
    ["?v=<?php echo attr_url($clinicalAssets->version('deleter-popup.css')); ?>", ''],
    ['deleter-popup.css?v=', 'workspace.css?v='],
    ['<body class="oe-deleter-popup">', '<body class="oe-deleter-popup body_top">'],
    ['container mt-3 oe-deleter-document', 'container mt-3 oe-deleter-document p-0'],
    ['class="oe-deleter-form" ', 'class="oe-deleter-form" role="dialog" '],
    ['use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n', ''],
];

describe('fixture and exact inverse (pass before and after implementation)', () => {
    test('the fixture is the unmodified 534-line original route', () => {
        const original = fixture();
        expect(original.split('\n').length - 1).toBe(534);
        expect(original.endsWith('</body>\n</html>\n')).toBe(true);
        expect(original).not.toContain('\r');
        expect(original).not.toContain('oe-');
        expect(original).not.toContain('ClinicalWorkspaceAssets');
        expect(original).not.toContain('<link');
        expect(original).toContain('\n<body>\n    <div class="container mt-3">\n        <?php\n');
    });

    test('every planned addition has one original anchor and round-trips exactly', () => {
        const original = fixture();
        for (const [before] of changes) expect(count(original, before)).toBe(1);
        const presented = apply(original);
        expect(presented).not.toBeNull();
        for (const [, after] of changes) expect(count(presented, after)).toBe(1);
        expect(restore(presented)).toBe(original);
        // Only the import and the two head lines add lines; nothing is reordered or removed.
        expect(presented.split('\n').length - original.split('\n').length).toBe(3);
    });

    test('negative controls: every behaviour mutation survives the inverse and is caught', () => {
        const original = fixture();
        const presented = apply(original);
        for (const [from, to] of behaviourMutations) {
            expect([from, count(original, from)]).toEqual([from, 1]);
            expect([from, count(presented, from)]).toEqual([from, 1]);
            expect(restore(presented.replace(from, () => to))).not.toBe(original);
        }
    });

    test('negative controls: changes to the planned presentation break the inverse', () => {
        const original = fixture();
        const presented = apply(original);
        for (const [from, to] of presentationMutations) {
            expect([from, count(presented, from)]).toEqual([from, 1]);
            expect(restore(presented.replace(from, () => to))).not.toBe(original);
        }
        // A stray edit outside the plan, a dropped edit and a duplicated edit are all rejected.
        expect(restore(presented.replace('            <p>\n', () => '            <p class="oe-deleter-message">\n'))).not.toBe(original);
        expect(restore(presented.replace(` ${LINK}\n`, () => ''))).toBeNull();
        expect(restore(presented.replace('</head>', () => `${LINK}\n</head>`))).not.toBe(original);
    });
});

describe('route (intended RED until the planned additions land)', () => {
    test('the route is the original plus exactly the planned additions', () => {
        const php = source();
        expect(php).toBe(apply(fixture()));
        expect(restore(php)).toBe(fixture());
    });

    test('the route links one versioned screen-only sheet and nothing else new', () => {
        const php = source();
        expect(count(php, 'deleter-popup.css')).toBe(2);
        expect(count(php, LINK)).toBe(1);
        expect(count(php, '<link ')).toBe(1);
        expect(php).not.toMatch(/workspace\.css|mode\.js|popup\.js/);
        expect(count(php, '<script')).toBe(count(fixture(), '<script'));
        expect(count(php, '<div')).toBe(count(fixture(), '<div'));
        expect(php).toContain('<body class="oe-deleter-popup">\n    <div class="container mt-3 oe-deleter-document">\n');
        expect(php).toContain('<form method=\'post\' name="deletefrm" class="oe-deleter-form" action=\'deleter.php?patient=');
    });

    test('the asset helper keeps its strict, sorted list with the base entries plus the new sheet', () => {
        const helper = read(HELPER);
        const block = helper.match(/private const SUPPORTED = \[\n([\s\S]*?)\n\s*\];/);
        expect(block).not.toBeNull();
        const names = block[1].split('\n').map(line => line.trim()).filter(Boolean)
            .map(line => line.match(/^'([a-z0-9.-]+)',$/)?.[1] ?? `UNPARSED:${line}`);
        const base = [
            'ajtooltip.js', 'appointment.css', 'calendar-sidebar.js', 'calendar-workday.css', 'calendar-workday.js',
            'encounter-document.css', 'finder.css', 'global-messages.css', 'history-document.css', 'history-editor.css',
            'issue-popup.css', 'lbf-document.css', 'mode.js', 'patient-messages.css', 'patient-picker-popup.css',
            'patient-results-popup.css', 'patient-search.css', 'soap-document.css', 'soap-document.js',
            'soap-reference.css', 'soap-reference.js', 'visit-history.css', 'visit-history.js', 'workspace.css',
        ];
        expect(names).toEqual([...base, 'deleter-popup.css'].sort());
        expect(new Set(names).size).toBe(names.length);
        expect(helper).toContain('in_array($asset, self::SUPPORTED, true)');
    });
});

describe('protected behaviour (pass before and after implementation)', () => {
    test.each([['fixture', fixture], ['route', source]])('%s keeps CSRF, ACLs, context check, logging, callbacks and controls', (label, load) => {
        const php = load();
        expect(php).toContain('if (!empty($_GET)) {\n    CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);\n}');
        expect(php).toContain("if (!empty($_POST['form_submit'])) {\n            CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);\n");
        expect(count(php, 'CsrfUtils::checkCsrfInput(')).toBe(2);
        expect(count(php, 'CsrfUtils::collectCsrfToken(session: $session)')).toBe(2);
        expect(count(php, 'AclMain::aclCheckCore(')).toBe(9);
        expect(count(php, 'AccessDeniedHelper::deny(')).toBe(9);
        expect(php).toContain("if (!AclMain::aclCheckCore('admin', 'super') || !OEGlobalsBag::getInstance()->getBoolean('allow_pat_delete')) {");
        expect(php).toContain("if (!AclMain::aclCheckCore('patients', 'docs_rm')) {");
        expect(php).toContain("if (!AclMain::aclCheckCore('acct', 'disc')) {");
        expect(php).toContain("$documentPid = CurrentRequest::get()->query->getInt('document_pid');");
        expect(php).toContain('if (!is_numeric($documentForeignId) || (int) $documentForeignId !== $documentPid) {');
        expect(php).toContain('&document_pid=<?php echo $documentPid ?>&');
        expect(count(php, 'EventAuditLogger::getInstance()->newEvent(')).toBe(2);
        expect(count(php, 'echo text($query) . "<br />\\n";')).toBe(2);
        expect(count(php, "getBoolean('sql_string_no_show_screen')")).toBe(4);
        expect(php).toContain('echo "let message = " . js_escape($info_msg) . ";');
        expect(count(php, 'js_escape($encounterid)')).toBe(2);
        expect(count(php, 'dlgclose(')).toBe(4);
        expect(php).toContain('function submit_form() {\n    top.restoreSession();\n    document.deletefrm.submit();\n}');
        expect(php).toContain('function popup_close() {\n    dlgclose();\n}');
        expect(php).toContain('<button onclick="submit_form()" class="btn btn-sm btn-primary mr-2"><?php echo xlt(\'Yes\'); ?></button>');
        expect(php).toContain('<button type="button" class="btn btn-sm btn-secondary" onclick="popup_close();"><?php echo xlt(\'No\');?></button>');
        expect(count(php, '<button')).toBe(2);
        expect(php).toContain("<input type='hidden' name='form_submit' value='delete'/>");
        expect(php).toContain('echo text($msg);');
        expect(php).toContain("<?php Header::setupHeader('opener'); ?>");
        expect(count(php, '<form')).toBe(1);
        expect(count(php, '<body')).toBe(1);
        expect(label).toBeTruthy();
    });

    test('the destructive PHP before the markup is byte-identical to the original', () => {
        const head = text => text.slice(text.indexOf('$session = SessionWrapperFactory'), text.indexOf('?>\n<html>'));
        expect(head(fixture()).length).toBeGreaterThan(5000);
        expect(head(source())).toBe(head(fixture()));
        const post = text => text.slice(text.indexOf("if (!empty($_POST['form_submit'])) {"), text.indexOf('        <form '));
        expect(post(source())).toBe(post(fixture()));
    });

    test('the caller still opens the original 500x450 iframe deleter dialog', () => {
        const php = read(CALLER);
        expect(php).toContain("dlgopen('../deleter.php?' + params.toString(), '_blank', 500, 450, '', '', {\n                allowResize: false,\n                allowDrag: false,\n                dialogId: 'patdel',\n                type: 'iframe'\n            });");
        expect(php).toContain('patient: <?php echo js_escape($pid); ?>\n            });\n            dlgopen(\'../deleter.php');
        expect(php).not.toMatch(/deleter-popup|oe-deleter/);
    });
});

// ---------------------------------------------------------------------------------------------
// Stylesheet: intended RED until deleter-popup.css exists.
// ---------------------------------------------------------------------------------------------

// Palette tokens as popup.css declares them under html.oe-workbench-context.
const tokens = () => {
    const map = {};
    postcss.parse(read('interface/clinical-workspace/popup.css')).walkRules(rule => {
        if (!rule.selectors.includes('html.oe-workbench-context')) return;
        rule.walkDecls(decl => { if (decl.prop.startsWith('--oe-wb-')) map[decl.prop] = decl.value; });
    });
    return map;
};

const rules = text => {
    const out = [];
    postcss.parse(text).walkRules(rule => {
        const decls = {};
        rule.walkDecls(decl => { decls[decl.prop] = `${decl.value}${decl.important ? ' !important' : ''}`; });
        out.push({ selectors: rule.selectors, decls });
    });
    return out;
};
const scopeOf = selector => SCOPES.find(scope => selector === scope || selector.startsWith(`${scope} `));
const restOf = selector => selector.slice(scopeOf(selector).length);
const declsFor = (text, rest) => Object.assign({}, ...rules(text)
    .filter(r => r.selectors.some(s => scopeOf(s) && restOf(s) === rest)).map(r => r.decls));
const token = (map, name) => `var(${name}, ${map[name]})`;

describe('deleter-popup.css (intended RED until the sheet exists)', () => {
    test('one top-level screen block; no print, import, font face, nested query or custom properties', () => {
        const tree = postcss.parse(requireCss());
        expect(tree.nodes.filter(node => node.type !== 'comment')).toHaveLength(1);
        const at = [];
        tree.walkAtRules(rule => at.push(`${rule.name} ${rule.params}`));
        expect(at).toEqual(['media screen']);
        tree.walkDecls(decl => expect(decl.prop.startsWith('--')).toBe(false));
    });

    test('every selector is scoped to an active workbench and the route body, in mirrored pairs', () => {
        const all = rules(requireCss());
        expect(all.length).toBeGreaterThanOrEqual(4);
        for (const { selectors } of all) {
            for (const selector of selectors) expect([selector, Boolean(scopeOf(selector))]).toEqual([selector, true]);
            const rests = scope => selectors.filter(s => scopeOf(s) === scope).map(restOf).sort();
            expect(rests(SCOPES[0])).toEqual(rests(SCOPES[1]));
        }
    });

    test('canvas body and paper document carry paired ink from the existing tokens', () => {
        const text = requireCss();
        const map = tokens();
        expect(declsFor(text, '')).toMatchObject({ color: token(map, '--oe-wb-ink'), 'background-color': token(map, '--oe-wb-canvas') });
        expect(declsFor(text, ' .oe-deleter-document')).toMatchObject({ color: token(map, '--oe-wb-ink'), 'background-color': token(map, '--oe-wb-paper') });
        for (const { decls } of rules(text)) {
            expect('color' in decls).toBe('background-color' in decls);
        }
    });

    test('palette comes from the existing tokens with matching literal fallbacks', () => {
        const text = requireCss();
        const map = tokens();
        const uses = [...text.matchAll(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*?)\s*)?\)/g)];
        expect(uses.length).toBeGreaterThan(0);
        for (const [, name, fallback] of uses) {
            expect(Object.keys(map)).toContain(name);
            expect(fallback).toBe(map[name]);
        }
        const withoutVars = text.replace(/var\([^)]*\)/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
        expect(withoutVars).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\b(red|purple|green|white|black)\b/i);
    });

    test('typography, gutters, buttons and semantic status stay with the theme', () => {
        const text = requireCss();
        expect(text).not.toContain('!important');
        const typography = /^(font|font-[\w-]+|line-height|letter-spacing|text-transform|text-align|word-spacing)$/;
        const gutters = /^(margin|margin-[\w-]+|padding|padding-(left|right)|width|max-width|min-width)$/;
        for (const { selectors, decls } of rules(text)) {
            for (const prop of Object.keys(decls)) {
                expect(prop).not.toMatch(typography);
                expect(prop).not.toMatch(gutters);
            }
            for (const selector of selectors) {
                const rest = restOf(selector);
                expect(rest).not.toMatch(/\.alert|\.text-|\.bg-|\.btn-(primary|secondary)|\.btn-group|\[style|:not\(|input|title/);
                if (/button|\.btn/.test(rest)) {
                    expect(rest).toMatch(/:focus(-visible)?$/);
                    for (const prop of Object.keys(decls)) expect(['outline', 'outline-offset']).toContain(prop);
                }
            }
        }
    });

    test(':focus and :focus-visible button outlines are separate rules and never removed', () => {
        const text = requireCss();
        const map = tokens();
        const all = rules(text);
        const isButton = s => /(button|\.btn)[\w.-]*:focus(-visible)?$/.test(s);
        const focus = all.filter(r => r.selectors.some(s => isButton(s) && s.endsWith(':focus')));
        const visible = all.filter(r => r.selectors.some(s => isButton(s) && s.endsWith(':focus-visible')));
        expect(focus).toHaveLength(1);
        expect(visible).toHaveLength(1);
        expect(focus[0].selectors.every(s => s.endsWith(':focus'))).toBe(true);
        expect(visible[0].selectors.every(s => s.endsWith(':focus-visible'))).toBe(true);
        const petrol = token(map, '--oe-wb-petrol').replace(/[()]/g, '\\$&');
        for (const rule of [focus[0], visible[0]]) {
            expect(rule.decls.outline).toMatch(new RegExp(`^\\d+px solid ${petrol}$`));
            expect(rule.decls['outline-offset']).toBeDefined();
        }
        expect(text).not.toMatch(/outline:\s*(none|0)\b|:not\(:focus-visible\)/);
    });

    test('nothing is hidden, clipped, pinned or resized, so the echoed SQL stays visible', () => {
        const forbidden = /^(display|visibility|opacity|position|top|left|right|bottom|float|overflow|overflow-x|overflow-y|height|max-height|min-height|white-space|text-overflow|pointer-events|user-select|content|clip|clip-path|z-index|transform|filter)$/;
        for (const { decls } of rules(requireCss())) {
            for (const prop of Object.keys(decls)) expect(prop).not.toMatch(forbidden);
        }
    });
});

// Scoping in jsdom. Not a native cascade or contrast test.
describe('source scoping in jsdom (intended RED until the sheet exists)', () => {
    const matching = element => rules(requireCss()).flatMap(r => r.selectors)
        .map(s => s.replace(/:focus(-visible)?$/, ''))
        .filter(s => { try { return element.matches(s); } catch { return false; } });

    const mount = htmlClass => {
        document.documentElement.className = htmlClass;
        document.body.className = 'oe-deleter-popup';
        document.body.innerHTML = `<div class="container mt-3 oe-deleter-document">
<form method="post" name="deletefrm" class="oe-deleter-form">
<p>You have selected to delete 1 patient. Are you sure you want to continue?</p>
<div class="btn-group">
<button id="yes" onclick="submit_form()" class="btn btn-sm btn-primary mr-2">Yes</button>
<button id="no" type="button" class="btn btn-sm btn-secondary" onclick="popup_close();">No</button>
</div>
<input type="hidden" name="form_submit" value="delete"/>
</form></div>`;
    };

    afterEach(() => {
        document.documentElement.className = '';
        document.body.className = '';
        document.body.innerHTML = '';
    });

    test.each([['active workbench context', 'oe-workbench-context'], ['workbench popup', 'oe-workbench-popup']])('%s: the body and document are styled, the controls keep their markup', (label, htmlClass) => {
        mount(htmlClass);
        expect(matching(document.body).length).toBeGreaterThan(0);
        expect(matching(document.querySelector('.oe-deleter-document')).length).toBeGreaterThan(0);
        expect(document.getElementById('yes').hasAttribute('type')).toBe(false);
        expect(document.getElementById('yes').className).toBe('btn btn-sm btn-primary mr-2');
        expect(document.getElementById('no').className).toBe('btn btn-sm btn-secondary');
        expect(label).toBeTruthy();
    });

    test('legacy direct page: the sheet is inert', () => {
        mount('');
        for (const element of [document.body, ...document.body.querySelectorAll('*')]) {
            expect(matching(element)).toEqual([]);
        }
    });
});
