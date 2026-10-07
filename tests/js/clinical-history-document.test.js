/**
 * @jest-environment jsdom
 */
/* global __dirname */

// History and Lifestyle view (interface/patient_file/history/history.php) as a quiet document
// inside the clinical workbench. The production change is presentation only: screen-only links to
// workspace.css and history-document.css plus the shared mode.js, a route body class, and
// presentation classes on two existing wrappers. These tests pin that nothing else in history.php
// changed (ACL/squad exits, newHistoryData, layout tabs, font override, skip conditions, menu,
// header, Edit and help), that the stylesheet is screen-only and inert outside an active
// workbench, and that it never hides, sizes or re-fonts layout-generated tabs, labels or values.
// The route deliberately does NOT load the shared workspace.css: its body font family/size and
// 0.8rem mobile container padding changed History typography and overflowed Bootstrap's -15px
// rows. history-document.css instead declares the few --oe-* tokens it needs on the route body.
//
// The DOM fixtures below are SYNTHETIC. They copy the element structure, ids and class names that
// display_layout_tabs()/display_layout_tabs_data() in library/options.inc.php emit; they are not
// rendered by PHP, carry no patient data and stand in for neither the database nor ACL behaviour.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const postcss = require('postcss');
const { createModeController } = require('../../interface/clinical-workspace/mode.js');

const root = path.join(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const readIfPresent = (relative) => (fs.existsSync(path.join(root, relative)) ? read(relative) : '');
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
// Git blob id of the file's exact bytes, so a pin names the immutable object, not just a checkout.
const gitBlob = (relative) => {
    const bytes = fs.readFileSync(path.join(root, relative));
    return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const HISTORY ='interface/patient_file/history/history.php';
const CSS = 'interface/clinical-workspace/history-document.css';
const BODY = 'body.oe-clinical-history-document.oe-clinical-workspace';
const SCOPE = `${BODY} #container_div.oe-history-document`;

// sha256 at master 5619373, before this change.
const ORIGINAL = {
    historyPhp: 'e03c50d90eac4878e258559c968f4b27f331461f3742d104546722533017b8af',
    workspaceCss: '0534d5ab77f344a94cf485a5e0cfa6c80a8de7745c3f533694998058d261590c'
};

// sha256 of the shared mode.js blob at 11509275 (merged PR #45 popup parent/opener provenance
// engine), an independently approved baseline this feature reuses without editing. The original
// 5619373 route pin was 10736b36a4ad44ae3dd0c7a519708bf5957c2d53b88dd2057ec8e791f61f2599.
const SHARED_ENGINE = {
    commit: '11509275',
    modeJs: '6a0a4bcfbe040be385376399df95870b9934b8181056fa5fbcd5a7128fcd6573'
};

// The History EDITOR (history_full.php) is a separate, independently reviewed lane (PR44) that is
// now integrated beside this view. It is pinned to its published source at d6dc903c rather than
// forbidden from carrying workbench markup; this view must still leak no route scope into it.
const APPROVED_EDITOR = {
    commit: 'd6dc903c07277531ea26a9efa05d8b8a25bb5f59',
    blob: '2b0c0d25ce363ae1eef9528239ce629cca75f727',
    historyFull: '976f4b3426630f9c65f9e14eec7275b87c8fc467a06a5cd2fef7134a91e520dd'
};

const WEBROOT = '<?php echo attr(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot()); ?>';
const asset = (name) => `${WEBROOT}/interface/clinical-workspace/${name}?v=<?php echo attr_url($clinicalAssets->version('${name}')); ?>`;
const HEAD_BLOCK = [
    '<?php $clinicalAssets = new \\OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets(); // Screen-only; inert until mode.js finds an active workbench. ?>',
    `<link rel="stylesheet" media="screen" href="${asset('history-document.css')}">`,
    `<script src="${asset('mode.js')}" defer></script>`,
    ''
].join('\n');

// Each [candidate, original] pair is the whole of an allowed history.php change.
const EDITS = [
    ['</style>\n' + HEAD_BLOCK, '</style>\n'],
    ['<body class="oe-clinical-history-document">\n', '<body>\n'],
    [
        '<div id="container_div" class="<?php echo $oemr_ui->oeContainer();?> mt-3 oe-history-document">',
        '<div id="container_div" class="<?php echo $oemr_ui->oeContainer();?> mt-3">'
    ],
    [
        '        <div class="row oe-history-actions">\n            <div class="col-sm-12">\n                <div class="btn-group">',
        '        <div class="row">\n            <div class="col-sm-12">\n                <div class="btn-group">'
    ]
];

function revert(text, edits) {
    return edits.reduce((out, [candidate, original]) => {
        expect(out.split(candidate)).toHaveLength(2);
        return out.replace(candidate, original);
    }, text);
}

const count = (text, needle) => text.split(needle).length - 1;

describe('history.php source preservation', () => {
    test('the only changes are the head asset block, the body class and two wrapper classes', () => {
        expect(sha256(revert(read(HISTORY), EDITS))).toBe(ORIGINAL.historyPhp);
    });

    test('every original control-flow call, exit, layout call and action survives exactly once more or less', () => {
        const source = read(HISTORY);
        const contracts = {
            "AclMain::aclCheckCore('patients', 'med')": 1,
            "AclMain::aclCheckCore('squads', $tmp['squad'])": 1,
            "AclMain::aclCheckCore('patients', 'med', '', ['write','addonly'])": 1,
            'getPatientData($pid, "squad")': 1,
            'exit();': 2,
            "xlt('History not authorized')": 2,
            'getHistoryData($pid)': 2,
            'newHistoryData($pid);': 1,
            "getLayoutProperties('HIS', $grparr, 'grp_size');": 1,
            '#HIS .groupname {': 1,
            '#HIS .label {': 1,
            '#HIS .data {': 1,
            '#HIS .data td {': 1,
            "display_layout_tabs('HIS', $result, ($result2 ?? ''));": 1,
            "display_layout_tabs_data('HIS', $result, ($result2 ?? ''));": 1,
            'tabbify();': 1,
            'checkSkipConditions();': 1,
            'var skipArray = [': 1,
            'erx_patient_portal_js.php': 1,
            'options.js.php': 1,
            'dashboard_header.php': 1,
            'displayHorizNavBarMenu();': 1,
            'href="history_full.php" class="btn btn-primary btn-edit" onclick="top.restoreSession()"': 1,
            "'help_file_name' => \"history_dashboard_help.php\"": 1,
            "'show_help_icon' => true": 1,
            '$oemr_ui->oeBelowContainerDiv();': 1,
            "Header::setupHeader('common');": 1
        };
        for (const [needle, expected] of Object.entries(contracts)) {
            expect([needle, count(source, needle)]).toEqual([needle, expected]);
        }
        expect(source).not.toMatch(/history_full\.php\?|sqlStatement|sqlQuery|QueryUtils/);
    });

    test('the asset block follows setupHeader and the HIS font override, before the OemrUI settings', () => {
        const source = read(HISTORY);
        const head = source.slice(source.indexOf('<head>'), source.indexOf('</head>'));
        const setup = head.indexOf("Header::setupHeader('common');");
        const fonts = head.indexOf('#HIS .data td {');
        const block = head.indexOf(HEAD_BLOCK);
        expect(setup).toBeGreaterThan(0);
        expect(block).toBeGreaterThan(fonts);
        expect(head.indexOf('$arrOeUiSettings')).toBeGreaterThan(block);
        expect(head).not.toMatch(/filemtime|__DIR__|getProjectDir\(\)\s*\.\s*['"]\/interface\/clinical-workspace/);
        expect(count(source, 'media="screen"')).toBe(1);
        expect(source).not.toMatch(/clinical-workspace\/workspace\.css/);
    });

    test('shared mode.js matches the merged engine baseline, workspace.css the original; the helper allowlists the new stylesheet', () => {
        expect(sha256(read('interface/clinical-workspace/mode.js'))).toBe(SHARED_ENGINE.modeJs);
        expect(sha256(read('interface/clinical-workspace/workspace.css'))).toBe(ORIGINAL.workspaceCss);
        expect(read('src/Common/Assets/ClinicalWorkspaceAssets.php')).toMatch(/\n {8}'history-document\.css',\n/);
    });

    test('the editor matches its approved lane source with no View scope; the layout renderer and core history theme are untouched', () => {
        const editor = 'interface/patient_file/history/history_full.php';
        expect(readIfPresent(CSS)).not.toBe('');
        expect([gitBlob(editor), sha256(read(editor))]).toEqual([APPROVED_EDITOR.blob, APPROVED_EDITOR.historyFull]);
        expect(read(editor)).not.toMatch(/oe-history-document|oe-clinical-history-document|oe-history-actions|history-document\.css/);
        expect(read('library/options.inc.php')).not.toMatch(/oe-history-document|oe-clinical-history-document/);
        expect(read('interface/themes/core/patient/history.scss')).not.toMatch(/oe-clinical/);
    });
});

// --- stylesheet ----------------------------------------------------------------------------

function cssRules() {
    const rules = [];
    postcss.parse(readIfPresent(CSS)).walkRules((rule) => rules.push(rule));
    return rules;
}

const decls = (rule) => Object.fromEntries(rule.nodes.filter((n) => n.type === 'decl').map((d) => [d.prop, d.value + (d.important ? ' !important' : '')]));

const varsIn = (text) => Object.fromEntries([...text.matchAll(/(--oe-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const sharedVars = () => varsIn(read('interface/clinical-workspace/workspace.css').match(/body\.oe-clinical-workspace\s*{([^}]*)}/)[1]);
const workspaceVars = () => {
    const rule = cssRules().find((candidate) => candidate.selector === BODY);
    return rule ? Object.fromEntries(Object.entries(decls(rule))) : {};
};

function resolveColor(value, vars) {
    const plain = value.replace(/\s*!important$/, '').trim();
    const ref = plain.match(/^var\((--oe-[\w-]+)\)$/);
    const hex = ref ? vars[ref[1]] : plain;
    const m = (hex || '').match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) throw new Error(`Unresolvable colour ${value}`);
    const digits = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
    return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
}

function contrast(a, b) {
    const lum = (rgb) => {
        const [r, g, bl] = rgb.map((c) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

describe('history-document.css', () => {
    test('every rule is a top-level @media screen rule scoped to the History route in an active workbench', () => {
        const rules = cssRules();
        expect(rules.length).toBeGreaterThanOrEqual(6);
        for (const rule of rules) {
            expect(rule.parent.type).toBe('atrule');
            expect(`@${rule.parent.name} ${rule.parent.params}`).toBe('@media screen');
            expect(rule.parent.parent.type).toBe('root');
            for (const selector of rule.selectors) {
                const allowed = selector.startsWith(`${SCOPE} `) || selector === BODY || selector === SCOPE;
                expect([selector, allowed]).toEqual([selector, true]);
            }
        }
        // The route body carries only presentation tokens: no colour, background or typography.
        const tokenRules = rules.filter((rule) => rule.selector === BODY);
        expect(tokenRules).toHaveLength(1);
        expect(Object.keys(decls(tokenRules[0])).filter((p) => !p.startsWith('--oe-'))).toEqual([]);
        // The container rule only pins Bootstrap's 15px gutters, matching the rows' -15px margins.
        const containerRules = rules.filter((rule) => rule.selector === SCOPE);
        expect(containerRules).toHaveLength(1);
        expect(decls(containerRules[0])).toEqual({ 'padding-right': '15px', 'padding-left': '15px' });
        expect(readIfPresent(CSS)).not.toMatch(/:has\(|@import|@media print|width\s*[<>]=?/);
    });

    test('no rule hides, clips, positions, floats or resizes anything', () => {
        const forbidden = /^(display|visibility|pointer-events|opacity|content|resize|float|clear|position|overflow|overflow-[xy]|clip|clip-path|height|max-height|min-height|width|max-width|min-width|z-index|transform)$/;
        for (const rule of cssRules()) {
            const props = Object.keys(decls(rule)).filter((p) => forbidden.test(p));
            expect([rule.selector, props]).toEqual([rule.selector, []]);
        }
    });

    test('configured HIS fonts are retained: no font-size, font-family, line-height or !important anywhere', () => {
        for (const rule of cssRules()) {
            const d = decls(rule);
            expect([rule.selector, 'font-size' in d, 'font' in d, 'font-family' in d, 'line-height' in d])
                .toEqual([rule.selector, false, false, false, false]);
            expect([rule.selector, Object.values(d).filter((v) => v.endsWith('!important'))]).toEqual([rule.selector, []]);
        }
    });

    test('every text colour is paired with its own background and meets WCAG AA', () => {
        const vars = workspaceVars();
        const paired = cssRules().filter((rule) => 'color' in decls(rule));
        expect(paired.length).toBeGreaterThanOrEqual(3);
        for (const rule of paired) {
            const d = decls(rule);
            expect([rule.selector, 'background-color' in d]).toEqual([rule.selector, true]);
            const ratio = contrast(resolveColor(d.color, vars), resolveColor(d['background-color'], vars));
            expect([rule.selector, ratio >= 4.5]).toEqual([rule.selector, true]);
        }
    });

    test('tab links and the Edit action get a visible petrol keyboard focus ring (theme sets outline: none)', () => {
        expect(read('interface/themes/theme-defaults.scss')).toMatch(/ul\.tabNav \{[\s\S]*?&:focus \{\s*outline: none;/);
        const focus = (selector) => cssRules().find((rule) => rule.selectors.includes(selector));
        for (const selector of [`${SCOPE} #HIS ul.tabNav a:focus-visible`, `${SCOPE} .oe-history-actions .btn-edit:focus-visible`]) {
            const rule = focus(selector);
            expect([selector, rule && decls(rule)]).toEqual([selector, expect.objectContaining({ outline: '2px solid var(--oe-petrol)' })]);
        }
    });

    test('route tokens reuse the researched workspace palette values', () => {
        const own = workspaceVars();
        const shared = sharedVars();
        for (const name of ['--oe-ink', '--oe-muted', '--oe-line', '--oe-paper', '--oe-petrol']) {
            expect([name, own[name]]).toEqual([name, shared[name]]);
        }
        expect(own['--oe-subtle']).toMatch(/^#[0-9a-f]{6}$/i);
    });

    test('dark theme: the renderer subtitle (inline var(--gray300) background) gets a light token and paired ink', () => {
        const rule = (selector) => cssRules().find((candidate) => candidate.selectors.includes(selector));
        const vars = workspaceVars();
        // display_layout_tabs_data() writes style='background-color: var(--gray300)'; redefining the
        // property on #HIS re-resolves that inline value without !important or markup changes.
        expect(decls(rule(`${SCOPE} #HIS`))).toMatchObject({ '--gray300': 'var(--oe-subtle)' });
        expect(contrast(resolveColor('var(--oe-ink)', vars), resolveColor('var(--oe-subtle)', vars))).toBeGreaterThanOrEqual(4.5);
        expect(decls(rule(`${SCOPE} #HIS div.tab td.label`))).toMatchObject({ color: 'var(--oe-ink)', 'background-color': 'var(--oe-paper)' });
    });

    test('dark theme: the nested lifestyle table.table and its cells get paired ink on paper', () => {
        const rule = (selector) => cssRules().find((candidate) => candidate.selectors.includes(selector));
        for (const selector of [`${SCOPE} #HIS div.tab td.data table.table`, `${SCOPE} #HIS div.tab td.data table.table td`]) {
            expect([selector, rule(selector) && decls(rule(selector))])
                .toEqual([selector, expect.objectContaining({ color: 'var(--oe-ink)', 'background-color': 'var(--oe-paper)' })]);
        }
    });

    test('semantic inline content (status strong, icons, spans) is never recoloured directly', () => {
        for (const rule of cssRules()) {
            for (const selector of rule.selectors) {
                expect([selector, /(\bspan|\bstrong|\bi|\.fa[\w-]*|\[id\^?=)\s*(:[\w-]+)?$/.test(selector)]).toEqual([selector, false]);
            }
        }
    });

    test('long tab titles and long values wrap rather than overflow', () => {
        const rule = (selector) => cssRules().find((candidate) => candidate.selectors.includes(selector));
        expect(decls(rule(`${SCOPE} #HIS ul.tabNav a`))).toMatchObject({ 'overflow-wrap': 'anywhere' });
        expect(decls(rule(`${SCOPE} #HIS div.tab td.data`))).toMatchObject({ 'overflow-wrap': 'anywhere' });
    });
});

// --- synthetic layout fixture ----------------------------------------------------------------

// Shapes copied from display_layout_tabs()/display_layout_tabs_data() in library/options.inc.php.
const LONG = 'SYNTHETIC-'.repeat(30);
const tabLink = (name, current) => `<li ${current ? 'class="current"' : ''}>\n<a href="#" id="header_tab_${name}">\n${name}</a>\n</li>\n`;
const field = (id, label, value, opts = {}) => {
    const labelCell = `<td class='label_custom' colspan='1' id='label_${id}'><span id='label_${id}'>${opts.skip ? '' : `${label}:`}</span>`;
    const style = opts.textarea ? " style='border: 1px solid var(--gray400)'" : '';
    const dataCell = `</td><td class='text data' colspan='3' id='text_${id}'  data-value='${value}'${style}>${opts.skip ? '' : value}</td>`;
    return `<tr>${labelCell}${dataCell}</tr>\n`;
};

// generate_display_field() type 28 ('note|currentFIELD'): a nested Bootstrap table.table.
const LIFESTYLE = "<tr><td class='label_custom' colspan='1' id='label_syn_tobacco'><span id='label_syn_tobacco'>SYNTHETIC tobacco:</span>"
    + "</td><td class='text data' colspan='3' id='text_syn_tobacco'  data-value='SYNTHETIC note|currentsyn_tobacco'>&nbsp;"
    + "<table class='table'><tr><td class='text align-top'>SYNTHETIC note&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>"
    + "<td class='text align-top'><strong>Status</strong>:&nbsp;Current&nbsp;</td></tr></table></td></tr>\n";

function page({ routeClass }) {
    return `<div id="container_div" class="container-fluid mt-3${routeClass ? ' oe-history-document' : ''}">
<div class="row"><div class="col-12"></div></div>
<div class="row${routeClass ? ' oe-history-actions' : ''}"><div class="col-sm-12"><div class="btn-group">
<a href="history_full.php" class="btn btn-primary btn-edit" onclick="top.restoreSession()">Edit</a>
</div></div></div>
<div class="row"><div class="col-sm-12" style="margin-top: 20px;">
<div id="HIS">
<ul class="tabNav">
${tabLink('General', true)}${tabLink('Family History', false)}${tabLink(LONG, false)}
</ul>
<div class="tabContainer">
<div class='tab current'>
<table border='0' cellpadding='0'>
<tr><td class='label' style='background-color: var(--gray300); padding: 4px' colspan='4'>SYNTHETIC subtitle</td></tr>
<tr><td class='label' style='height: 5px' colspan='4'></td></tr>
${field('syn_risk', 'SYNTHETIC risk', 'SYNTHETIC value')}${LIFESTYLE}${field('syn_note', 'SYNTHETIC note', LONG, { textarea: true })}${field('syn_skip', 'SYNTHETIC skipped', '', { skip: true })}
<tr><td class='label_custom' colspan='1' id='label_syn_inline'><span class='text-nowrap mr-2'><span id='label_syn_inline'>SYNTHETIC inline:</span><span id='text_syn_inline' style='display: none'>SYNTHETIC hidden value</span></span></td><td></td><td></td><td></td></tr>
</table>
</div>
<div class='tab'>
<table border='0' cellpadding='0'>${field('syn_family', 'SYNTHETIC family', 'SYNTHETIC family value')}</table>
</div>
<div class='tab'>
<table border='0' cellpadding='0'>${field('syn_long', 'SYNTHETIC long', LONG)}</table>
</div>
</div>
</div>
</div></div>
</div>`;
}

function mount(options) {
    document.body.className = options.routeClass ? 'oe-clinical-history-document' : '';
    document.body.innerHTML = page(options);
}

// Every node's tag, id, class, inline style, href, onclick and data-value, in document order.
const snapshot = () => [...document.body.querySelectorAll('*')].map((el) => [
    el.tagName, el.id, el.getAttribute('class'), el.getAttribute('style'), el.getAttribute('href'),
    el.getAttribute('onclick'), el.getAttribute('data-value'), el.getAttribute('colspan')
].join('|'));

function hostWindow(active) {
    const hostBody = document.implementation.createHTMLDocument('host').body;
    if (active) hostBody.classList.add('workbench-active');
    return {
        hostBody,
        win: { location: { origin: 'https://synthetic.invalid' }, document: { body: hostBody }, parent: null }
    };
}

function startMode(win) {
    const callbacks = [];
    const controller = createModeController({
        body: document.body,
        parentWindow: win,
        origin: 'https://synthetic.invalid',
        observe: (_target, callback) => {
            callbacks.push(callback);
            return { disconnect() {} };
        }
    });
    return { controller, notify: () => callbacks.forEach((c) => c()) };
}

const stripState = (selector) => selector.replace(/:(hover|focus-visible|focus|active)\b/g, '');
const matchedRules = () => cssRules().flatMap((rule) => rule.selectors
    .flatMap((s) => [...document.querySelectorAll(stripState(s))].map((el) => ({ el, rule }))));

describe('SYNTHETIC History layout fixture', () => {
    afterEach(() => {
        document.body.className = '';
        document.body.innerHTML = '';
    });

    test('workbench mode toggles only the body class; every generated id, node and hidden value is kept', () => {
        mount({ routeClass: true });
        const before = snapshot();
        const nodes = [...document.body.querySelectorAll('*')];
        expect(document.querySelectorAll('[id^="header_tab_"]')).toHaveLength(3);
        expect(document.querySelectorAll('td[id^="text_"].data')).toHaveLength(6);

        const { hostBody, win } = hostWindow(true);
        const { controller, notify } = startMode(win);
        expect(document.body.className).toBe('oe-clinical-history-document oe-clinical-workspace');
        expect(snapshot()).toEqual(before);
        expect([...document.body.querySelectorAll('*')]).toEqual(nodes);
        expect(document.getElementById('text_syn_inline').style.display).toBe('none');
        expect(document.querySelectorAll('div.tab.current')).toHaveLength(1);

        hostBody.classList.remove('workbench-active');
        notify();
        expect(document.body.className).toBe('oe-clinical-history-document');
        controller.dispose();
        expect(snapshot()).toEqual(before);
    });

    test('legacy: without an active workbench ancestor the stylesheet is fully inert', () => {
        mount({ routeClass: true });
        startMode(hostWindow(false).win);
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(false);
        expect(matchedRules()).toEqual([]);
    });

    test('other routes (no route class) stay inert even inside an active workbench', () => {
        mount({ routeClass: false });
        startMode(hostWindow(true).win);
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(true);
        expect(matchedRules()).toEqual([]);
    });

    test('in the workbench the sheet frames tabs, panels and the action row but never sizes cells', () => {
        mount({ routeClass: true });
        startMode(hostWindow(true).win);
        const matches = matchedRules();
        const hit = (selector) => matches.some(({ el }) => el.matches(selector));
        expect(hit('#HIS')).toBe(true);
        expect(hit('ul.tabNav a')).toBe(true);
        expect(hit('ul.tabNav li.current a')).toBe(true);
        expect(hit('div.tabContainer div.tab')).toBe(true);
        expect(hit('.oe-history-actions')).toBe(true);
        expect(hit('td.data table.table')).toBe(true);
        expect(hit('td.data table.table td')).toBe(true);
        expect(hit('div.tab td.label')).toBe(true);
        const geometry = /^(width|min-width|max-width|height|min-height|max-height|flex|flex-basis|white-space|text-align|vertical-align|line-height|font-size|font-weight|padding|padding-[a-z]+|margin|margin-[a-z]+|box-sizing)$/;
        for (const { el, rule } of matches) {
            if (el.matches('td, tr, table, span, [id^="label_"], [id^="text_"]')) {
                const props = Object.keys(decls(rule)).filter((p) => geometry.test(p));
                expect([rule.selector, props]).toEqual([rule.selector, []]);
            }
        }
    });

    test('the inactive tab panels and skip-hidden spans gain no rule that could reveal them', () => {
        mount({ routeClass: true });
        startMode(hostWindow(true).win);
        const hidden = [...document.querySelectorAll('div.tab:not(.current), #text_syn_inline')];
        for (const { el, rule } of matchedRules()) {
            if (hidden.includes(el)) {
                expect(Object.keys(decls(rule))).not.toContain('display');
            }
        }
    });
});
