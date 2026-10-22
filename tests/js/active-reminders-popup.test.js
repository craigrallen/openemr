/** @jest-environment jsdom */

/*
 * OPEMR-4: active reminder popup as a document-shaped sheet inside an active workbench popup.
 *
 * Tests-first slice. Before implementation the intended RED is limited to the planned
 * presentation (route additions, helper registration and the new screen sheet). The fixture,
 * inverse, negative-mutation, behaviour and caller tests are expected to pass both before
 * and after implementation. A missing stylesheet fails each CSS test with one readable
 * message instead of a file-system stack.
 *
 * These are source/cascade checks only. They are not native contrast, layout or browser
 * acceptance; see docs/clinical-ui/ACTIVE-REMINDERS-POPUP.md.
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

const ROUTE = 'interface/patient_file/reminder/active_reminder_popup.php';
const FIXTURE = 'tests/clinical-ui/fixtures/active-reminders-original.txt';
const CSS_FILE = 'interface/clinical-workspace/active-reminders-popup.css';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const CALLER = 'interface/patient_file/summary/demographics.php';
const SCOPE = 'html.oe-workbench-context.oe-workbench-popup body.oe-active-reminders';

const source = () => read(ROUTE);
const fixture = () => read(FIXTURE);
const count = (text, part) => text.split(part).length - 1;

const requireCss = () => {
    const text = readOptional(CSS_FILE);
    if (text === null) {
        throw new Error(`${CSS_FILE} is not present yet (intended RED until the presentation is implemented)`);
    }
    return text;
};

// Every planned route edit as [original, presented]. Only one import, one versioned screen
// link, two route classes and one wrapper around the existing body contents are added.
const changes = [
    ['use OpenEMR\\Core\\Header;\n', 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Core\\Header;\n'],
    ["<?php Header::setupHeader('opener'); ?>\n</head>\n", "<?php Header::setupHeader('opener'); ?>\n<?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n<link rel=\"stylesheet\" media=\"screen\" href=\"<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/active-reminders-popup.css?v=<?php echo attr_url($clinicalAssets->version('active-reminders-popup.css')); ?>\">\n</head>\n"],
    ['<body class="body_top">\n', '<body class="body_top oe-active-reminders">\n<div class="oe-reminders-sheet">\n'],
    ['<table class="table border-0">\n', '<table class="table border-0 oe-reminders-heading">\n'],
    ['echo $active_alerts;\n?>\n</body>\n', 'echo $active_alerts;\n?>\n</div>\n</body>\n'],
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

// Behaviour the slice must not touch: [anchor, mutation]. Each anchor occurs exactly once.
const behaviourMutations = [
    ['require_once("../../globals.php");\n', ''],
    ["$session = \\OpenEMR\\Common\\Session\\SessionWrapperFactory::getInstance()->getActiveSession();", '$session = null;'],
    ["$pid = $session->get('pid', 0);", "$pid = $session->get('pid');"],
    ['require_once(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getSrcDir() . "/clinical_rules.php");\n', ''],
    ["Header::setupHeader('opener')", 'Header::setupHeader()'],
    ['$all_allergy_alerts = [];', '$all_allergy_alerts = false;'],
    ["if (OEGlobalsBag::getInstance()->getBoolean('enable_allergy_check')) {", 'if (true) {'],
    ["allergy_conflict($pid, 'all', $session->get('authUser'))", "allergy_conflict($pid, 'new', $session->get('authUser'))"],
    ["active_alert_summary($pid, \"reminders-due\", '', 'default', $session->get('authUser'))", "active_alert_summary($pid, \"reminders-due\", '', 'default', $session->get('authUser'), true)"],
    ['if (!empty($active_alerts) && empty($all_allergy_alerts)) {', 'if (!empty($active_alerts)) {'],
    ['} elseif (!empty($active_alerts) && !empty($all_allergy_alerts)) {', '} elseif (!empty($all_allergy_alerts)) {'],
    ['echo xlt("Alerts/Reminders");', 'echo text("Alerts/Reminders");'],
    ['echo xlt("WARNINGS and Alerts/Reminders");', 'echo xlt("Warnings and Alerts/Reminders");'],
    ['echo xlt("WARNINGS");', 'echo "WARNINGS";'],
    ['<span class="title">', '<span class="title text-danger">'],
    ['href="#"', 'href="javascript:void(0)"'],
    ['id="close"', 'id="close-button"'],
    ['class="btn btn-secondary btn-lg"', 'class="btn btn-primary btn-lg"'],
    ['onclick="dlgclose(); return false;"', 'onclick="dlgclose();"'],
    ["<?php echo xlt('Close');?>", "<?php echo xla('Close');?>"],
    ['if (!empty($all_allergy_alerts)) {', 'if ($all_allergy_alerts) {'],
    ['foreach ($all_allergy_alerts as $allergy) {', 'foreach ([] as $allergy) {'],
    ['xlt("ALLERGY WARNING")', 'xl("ALLERGY WARNING")'],
    ['text($allergy)', '$allergy'],
    ['echo $active_alerts;', 'echo text($active_alerts);'],
];

// Edits to the planned presentation itself that the exact inverse must reject.
const presentationMutations = [
    ['media="screen"', 'media="all"'],
    ["?v=<?php echo attr_url($clinicalAssets->version('active-reminders-popup.css')); ?>", ''],
    ['active-reminders-popup.css?v=', 'workspace.css?v='],
    ['<body class="body_top oe-active-reminders">', '<body class="oe-active-reminders">'],
    ['<div class="oe-reminders-sheet">', '<div class="oe-reminders-sheet" role="dialog">'],
    ['<table class="table border-0 oe-reminders-heading">', '<table class="table border-0 oe-reminders-heading text-white">'],
    ['?>\n</div>\n</body>', '?>\n</body>\n</div>'],
];

describe('fixture and exact inverse (pass before and after implementation)', () => {
    test('the fixture is the unmodified 72-line original route', () => {
        const original = fixture();
        expect(original.split('\n').length - 1).toBe(72);
        expect(original.endsWith('</body>\n</html>\n')).toBe(true);
        expect(original).not.toContain('\r');
        expect(original).not.toContain('oe-');
        expect(original).not.toContain('ClinicalWorkspaceAssets');
        expect(original).not.toContain('<link');
        expect(original).toContain('<body class="body_top">\n\n<table class="table border-0">\n<tr>\n');
    });

    test('every planned addition has one original anchor and round-trips exactly', () => {
        const original = fixture();
        for (const [before] of changes) expect(count(original, before)).toBe(1);
        const presented = apply(original);
        expect(presented).not.toBeNull();
        for (const [, after] of changes) expect(count(presented, after)).toBe(1);
        expect(restore(presented)).toBe(original);
        // Only the planned lines are added; nothing in the original is reordered or removed.
        expect(presented.split('\n').length - original.split('\n').length).toBe(5);
    });

    test('negative controls: every behaviour mutation survives the inverse and is caught', () => {
        const original = fixture();
        const presented = apply(original);
        for (const [from, to] of behaviourMutations) {
            expect(count(original, from)).toBe(1);
            expect(count(presented, from)).toBe(1);
            const mutated = presented.replace(from, () => to);
            expect(restore(mutated)).not.toBe(original);
        }
    });

    test('negative controls: changes to the planned presentation break the inverse', () => {
        const original = fixture();
        const presented = apply(original);
        for (const [from, to] of presentationMutations) {
            expect(count(presented, from)).toBe(1);
            expect(restore(presented.replace(from, () => to))).not.toBe(original);
        }
        // A stray edit outside the plan, a dropped edit and a duplicated edit are all rejected.
        expect(restore(presented.replace('<td>\n    <a href="#"', () => '<td class="oe-extra">\n    <a href="#"'))).not.toBe(original);
        expect(restore(presented.replace('<div class="oe-reminders-sheet">\n', () => ''))).toBeNull();
        expect(restore(presented.replace('</body>', () => '</div>\n</body>'))).not.toBe(original);
    });
});

describe('route (intended RED until the planned additions land)', () => {
    test('the route is the original plus exactly the planned additions', () => {
        const php = source();
        expect(php).toBe(apply(fixture()));
        expect(restore(php)).toBe(fixture());
    });

    test('the route links one versioned screen-only sheet and never the shared workspace.css', () => {
        const php = source();
        expect(count(php, 'active-reminders-popup.css')).toBe(2);
        expect(php).toContain('<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/active-reminders-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'active-reminders-popup.css\')); ?>">');
        expect(count(php, '<link ')).toBe(1);
        expect(php).not.toContain('workspace.css');
        expect(php).not.toContain('mode.js');
        expect(php).toContain('<body class="body_top oe-active-reminders">\n<div class="oe-reminders-sheet">\n');
        expect(php).toContain('<table class="table border-0 oe-reminders-heading">');
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
        for (const name of base) expect(names).toContain(name);
        expect(names).toEqual([...base, 'active-reminders-popup.css'].sort());
        expect(new Set(names).size).toBe(names.length);
        expect(helper).toContain('in_array($asset, self::SUPPORTED, true)');
    });
});

describe('protected behaviour (pass before and after implementation)', () => {
    test.each([['fixture', fixture], ['route', source]])('%s keeps session, rules, headings, escaping and Close', (label, load) => {
        const php = load();
        expect(php).toContain("$pid = $session->get('pid', 0);");
        expect(count(php, "$session->get('authUser')")).toBe(2);
        expect(php).toContain("if (OEGlobalsBag::getInstance()->getBoolean('enable_allergy_check')) {\n  // Will show allergy and medication/prescription conflicts here\n    $all_allergy_alerts = allergy_conflict($pid, 'all', $session->get('authUser'));\n}");
        // No test=true: the route may write the alert log when enable_alert_log is on (unchanged).
        expect(php).toContain("$active_alerts = active_alert_summary($pid, \"reminders-due\", '', 'default', $session->get('authUser'));");
        expect(php).toContain('if (!empty($active_alerts) && empty($all_allergy_alerts)) {\n    echo xlt("Alerts/Reminders");\n} elseif (!empty($active_alerts) && !empty($all_allergy_alerts)) {\n    echo xlt("WARNINGS and Alerts/Reminders");\n} else { // empty($active_alerts) && !empty($all_allergy_alerts)\n    echo xlt("WARNINGS");\n}');
        expect(php).toContain('echo xlt("ALLERGY WARNING") . ":" . text($allergy) . "<br />";');
        // Raw active-alert HTML keeps the inline due-status colours; it must not be escaped.
        expect(php).toContain('\necho $active_alerts;\n');
        expect(php).not.toMatch(/text\(\$active_alerts\)|attr\(\$active_alerts\)|strip_tags/);
        expect(php).toContain('<a href="#" id="close" class="btn btn-secondary btn-lg" onclick="dlgclose(); return false;"><?php echo xlt(\'Close\');?></a>');
        expect(count(php, 'dlgclose(')).toBe(1);
        expect(php).toContain("<?php Header::setupHeader('opener'); ?>");
        expect(php).toContain('<span class="title">\n');
        expect(php).not.toMatch(/\$_(GET|POST|REQUEST|COOKIE|SERVER)\b|filter_input|CurrentRequest/);
        expect(count(php, '<body')).toBe(1);
        expect(label).toBeTruthy();
    });

    test('the caller still opens the original 500x250 iframe dialog with its own Close and quiet probe', () => {
        const php = read(CALLER);
        const start = php.indexOf('function openReminderPopup() {');
        expect(start).toBeGreaterThan(-1);
        expect(count(php, 'function openReminderPopup() {')).toBe(1);
        const block = php.slice(start, php.indexOf('\n            }\n', start));
        expect(block).toContain("top.restoreSession()\n                dlgopen('', 'reminders', 500, 250, '', '', {");
        expect(block).toContain("buttons: [{\n                        text: <?php echo xlj('Close'); ?>,\n                        close: true,\n                        style: 'secondary btn-sm'\n                    }],");
        expect(block).toContain("allowResize: true,\n                    allowDrag: true,\n                    dialogId: '',\n                    type: 'iframe',\n                    url: $(\"#reminder_popup_link\").attr('href')");
        expect(php).toContain("<a href='../reminder/active_reminder_popup.php' id='reminder_popup_link' style='display: none' onclick='top.restoreSession()'></a>");
        expect(count(php, 'openReminderPopup();')).toBe(2);
        // The dashboard only probes with test=true, so it does not log; the popup route logs.
        expect(php).toContain("active_alert_summary($pid, \"reminders-due\", '', 'default', $session->get('authUser'), true);");
        expect(php).toContain("allergy_conflict($pid, 'all', $session->get('authUser'), true);");
        expect(php).not.toContain('active-reminders-popup.css');
    });
});

// ---------------------------------------------------------------------------------------------
// Stylesheet: intended RED until active-reminders-popup.css exists.
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
const declsFor = (text, selector) => Object.assign({}, ...rules(text).filter(r => r.selectors.includes(selector)).map(r => r.decls));
const ink = map => `var(--oe-wb-ink, ${map['--oe-wb-ink']})`;
const paper = map => `var(--oe-wb-paper, ${map['--oe-wb-paper']})`;
const canvas = map => `var(--oe-wb-canvas, ${map['--oe-wb-canvas']})`;
const line = map => `var(--oe-wb-line, ${map['--oe-wb-line']})`;
const petrol = map => `var(--oe-wb-petrol, ${map['--oe-wb-petrol']})`;

describe('active-reminders-popup.css (intended RED until the sheet exists)', () => {
    test('one top-level screen block; no print, import, nested width query or custom properties', () => {
        const text = requireCss();
        const tree = postcss.parse(text);
        expect(tree.nodes.filter(node => node.type !== 'comment')).toHaveLength(1);
        expect(tree.nodes.find(node => node.type === 'atrule')?.params).toBe('screen');
        const at = [];
        tree.walkAtRules(rule => at.push(`${rule.name} ${rule.params}`));
        expect(at).toEqual(['media screen']);
        tree.walkDecls(decl => expect(decl.prop.startsWith('--')).toBe(false));
    });

    test('every selector is scoped to the workbench context, popup and route body', () => {
        const all = rules(requireCss());
        expect(all.length).toBeGreaterThanOrEqual(5);
        for (const { selectors } of all) {
            for (const selector of selectors) {
                expect(selector === SCOPE || selector.startsWith(`${SCOPE} `)).toBe(true);
            }
        }
    });

    test('canvas body, paper sheet and paired ink on the heading table, cells and title', () => {
        const text = requireCss();
        const map = tokens();
        expect(declsFor(text, SCOPE)).toMatchObject({ color: ink(map), 'background-color': canvas(map) });
        const sheet = declsFor(text, `${SCOPE} .oe-reminders-sheet`);
        expect(sheet).toMatchObject({
            color: ink(map),
            'background-color': paper(map),
            border: `1px solid ${line(map)}`,
            'overflow-wrap': 'anywhere',
        });
        expect(sheet.padding).toBeDefined();
        for (const part of ['.oe-reminders-heading', '.oe-reminders-heading td']) {
            expect(declsFor(text, `${SCOPE} ${part}`)).toMatchObject({ color: ink(map), 'background-color': paper(map) });
        }
        expect(declsFor(text, `${SCOPE} .oe-reminders-heading .title`)).toMatchObject({ color: ink(map), 'background-color': 'transparent' });
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
        // No literal colours outside fallbacks, and no semantic palette values.
        const withoutVars = text.replace(/var\([^)]*\)/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
        expect(withoutVars).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\b(red|purple|green|white|black)\b/i);
    });

    test('typography, buttons and semantic colour stay with the theme and the raw alert HTML', () => {
        const text = requireCss();
        expect(text).not.toContain('!important');
        const typography = /^(font|font-[\w-]+|line-height|letter-spacing|text-transform|text-align|word-spacing)$/;
        for (const { selectors, decls } of rules(text)) {
            for (const prop of Object.keys(decls)) expect(prop).not.toMatch(typography);
            for (const selector of selectors) {
                const rest = selector.slice(SCOPE.length);
                expect(rest).not.toMatch(/\bspan\b|\[style|(^|[\s>+~])(a|b|strong|font|br)(?=$|[\s.#:[>+~])|\.btn|\.alert|\.text-|\.bg-|:not\(/);
                if (rest.includes('#close')) {
                    expect([' #close:focus', ' #close:focus-visible']).toContain(rest);
                    for (const prop of Object.keys(decls)) expect(['outline', 'outline-offset']).toContain(prop);
                }
            }
        }
    });

    test(':focus and :focus-visible are separate rules and never remove the outline', () => {
        const text = requireCss();
        const map = tokens();
        const all = rules(text);
        const focus = all.filter(r => r.selectors.includes(`${SCOPE} #close:focus`));
        const visible = all.filter(r => r.selectors.includes(`${SCOPE} #close:focus-visible`));
        expect(focus).toHaveLength(1);
        expect(visible).toHaveLength(1);
        expect(focus[0]).not.toBe(visible[0]);
        expect(focus[0].selectors).toEqual([`${SCOPE} #close:focus`]);
        expect(visible[0].selectors).toEqual([`${SCOPE} #close:focus-visible`]);
        for (const rule of [focus[0], visible[0]]) {
            expect(rule.decls.outline).toMatch(new RegExp(`^\\d+px solid ${petrol(map).replace(/[()]/g, '\\$&')}$`));
            expect(rule.decls['outline-offset']).toBeDefined();
        }
        expect(text).not.toMatch(/outline:\s*(none|0)\b|:not\(:focus-visible\)/);
    });

    test('nothing is hidden, clipped, pinned or sized to the 500x250 frame', () => {
        const text = requireCss();
        const forbidden = /^(display|visibility|opacity|position|overflow|overflow-x|overflow-y|height|max-height|min-height|white-space|pointer-events|user-select|content|clip|clip-path|z-index|transform)$/;
        for (const { decls } of rules(text)) {
            for (const prop of Object.keys(decls)) expect(prop).not.toMatch(forbidden);
        }
    });
});

// Source cascade in jsdom. Not a native contrast test: values are resolved, not rendered.
const specificity = selector => {
    const bare = selector.replace(/\[[^\]]*\]/g, '.a').replace(/::[\w-]+/g, ' x');
    const ids = (bare.match(/#[\w-]+/g) || []).length;
    const classes = (bare.match(/\.[\w-]+|:[\w-]+/g) || []).length;
    const types = (bare.replace(/[#.:][\w-]+/g, ' ').match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
    return ids * 1e6 + classes * 1e3 + types;
};

// Synthetic dark-theme stand-in with explicit ink (not the compiled theme): the route sheet
// must win over it on its own scope. Native compiled-theme checks remain pending.
const themeStub = '.body_top{background-color:#1f2326;color:#e6e6e6}.title{color:#e6e6e6}.table{color:#e6e6e6;background-color:transparent}';

const cascadeDecls = () => {
    const out = [];
    let order = 0;
    const take = (text, screenOnly) => postcss.parse(text).walkRules(rule => {
        const media = [];
        for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) media.push(p.params);
        if (media.some(m => m !== 'screen') || (screenOnly && !media.includes('screen'))) return;
        for (const selector of rule.selectors) {
            rule.walkDecls(d => out.push({ selector, prop: d.prop, value: d.value, important: d.important, spec: specificity(selector), order: order++ }));
        }
    });
    take(themeStub, false);
    take(read('interface/clinical-workspace/popup.css'), true);
    take(requireCss(), true);
    return out;
};

const resolve = (value, map) => value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*?)\s*)?\)/g, (m, name, fb) => map[name] ?? fb ?? m);

const computed = (element, prop) => {
    const map = tokens();
    let winner = null;
    for (const d of cascadeDecls()) {
        if (d.prop !== prop) continue;
        let matches = false;
        try { matches = element.matches(d.selector); } catch { continue; }
        if (!matches) continue;
        const rank = [d.important ? 1 : 0, d.spec, d.order];
        if (!winner || rank[0] > winner.rank[0] || (rank[0] === winner.rank[0] && (rank[1] > winner.rank[1] || (rank[1] === winner.rank[1] && rank[2] > winner.rank[2])))) {
            winner = { rank, value: d.value };
        }
    }
    const inline = element.style.getPropertyValue(prop);
    if (inline && !(winner && winner.rank[0])) return inline;
    return winner ? resolve(winner.value, map) : undefined;
};

const routeSelectorsMatching = element => rules(requireCss()).flatMap(r => r.selectors).filter(selector => {
    try { return element.matches(selector); } catch { return false; }
});

// Rendered shape of the presented route with both alert families and every due status.
const mount = htmlClass => {
    document.documentElement.className = htmlClass;
    document.body.className = 'body_top oe-active-reminders';
    document.body.innerHTML = `<div class="oe-reminders-sheet">
<table class="table border-0 oe-reminders-heading"><tbody><tr>
<td><span class="title">WARNINGS and Alerts/Reminders</span>&nbsp;&nbsp;&nbsp;</td>
<td><a href="#" id="close" class="btn btn-secondary btn-lg" onclick="dlgclose(); return false;">Close</a></td>
</tr></tbody></table>
<br />
ALLERGY WARNING:Penicillin<br /><br />
Assessment: Tobacco&nbsp;&nbsp;(<span id="past" style='color:red'>Past Due</span>)<br />
Measurement: Weight&nbsp;&nbsp;(<span id="due" style='color:purple'>Due</span>)<br />
Education: Diet&nbsp;&nbsp;(<span id="notdue" style='color:green'>Not Due</span>)<br />
Examination: Foot&nbsp;&nbsp;(<span id="soon">Due Soon</span>)<br />
<br /><b id="plan">Plan: Diabetes Mellitus</b><br />
Reminder: ${'Supercalifragilisticexpialidocious'.repeat(8)}<br />
</div>`;
};

describe('source cascade in jsdom (intended RED until the sheet exists)', () => {
    afterEach(() => {
        document.documentElement.className = '';
        document.body.className = '';
        document.body.innerHTML = '';
    });

    test('active workbench popup: canvas body, paper sheet, ink heading over an explicit-ink theme', () => {
        const map = tokens();
        mount('oe-workbench-context oe-workbench-popup');
        expect(computed(document.body, 'background-color')).toBe(map['--oe-wb-canvas']);
        const sheet = document.querySelector('.oe-reminders-sheet');
        expect(computed(sheet, 'background-color')).toBe(map['--oe-wb-paper']);
        expect(computed(sheet, 'color')).toBe(map['--oe-wb-ink']);
        const table = document.querySelector('.oe-reminders-heading');
        expect(computed(table, 'color')).toBe(map['--oe-wb-ink']);
        expect(computed(table, 'background-color')).toBe(map['--oe-wb-paper']);
        for (const cell of document.querySelectorAll('.oe-reminders-heading td')) {
            expect(computed(cell, 'color')).toBe(map['--oe-wb-ink']);
            expect(computed(cell, 'background-color')).toBe(map['--oe-wb-paper']);
        }
        expect(computed(document.querySelector('.title'), 'color')).toBe(map['--oe-wb-ink']);
    });

    test('inline due-status colours, plan text and the Close button keep their own styling', () => {
        mount('oe-workbench-context oe-workbench-popup');
        expect(computed(document.getElementById('past'), 'color')).toBe('red');
        expect(computed(document.getElementById('due'), 'color')).toBe('purple');
        expect(computed(document.getElementById('notdue'), 'color')).toBe('green');
        for (const id of ['past', 'due', 'notdue', 'soon', 'plan']) {
            expect(routeSelectorsMatching(document.getElementById(id))).toEqual([]);
        }
        const close = document.getElementById('close');
        expect(close.className).toBe('btn btn-secondary btn-lg');
        expect(routeSelectorsMatching(close)).toEqual([]);
    });

    test.each([
        ['legacy direct page', ''],
        ['workbench context without popup', 'oe-workbench-context'],
        ['popup class without context', 'oe-workbench-popup'],
    ])('%s: the route sheet is inert', (label, htmlClass) => {
        mount(htmlClass);
        for (const element of [document.body, ...document.body.querySelectorAll('*')]) {
            expect(routeSelectorsMatching(element)).toEqual([]);
        }
        expect(label).toBeTruthy();
    });
});
