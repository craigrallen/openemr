/**
 * @jest-environment jsdom
 */

// History and Lifestyle editor (interface/patient_file/history/history_full.php) as a quiet
// document inside the clinical workbench. The production change is presentation only: one head
// block that links history-editor.css (screen only) and the shared mode.js, a route body class,
// a container class and an action-group class. These tests pin that nothing else in the page
// changed, that the stylesheet is screen-only and inert outside an active workbench, that it
// never touches typography or the sizing/visibility of tabs, groups and controls, and that every
// text colour it sets is paired with its own surface so light and dark themes stay readable.
//
// The DOM fixture below is SYNTHETIC. It copies the element structure and class names that
// history_full.php and display_layout_tabs()/display_layout_tabs_data_editable() write; it is
// not rendered by PHP, carries no patient data and stands in for neither the database nor ACL,
// CSRF or save behaviour.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const postcss = require('postcss');
const { createModeController } = require('../../interface/clinical-workspace/mode.js');

// Node global (tests/js gets ESLint's node globals); named for what it is, not redeclared.
const testFileDirectory = __dirname;
const root = path.join(testFileDirectory, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
// The stylesheet is read leniently so its absence fails the content assertions, not the loader.
const readIfPresent = (relative) => (fs.existsSync(path.join(root, relative)) ? read(relative) : '');
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
// Git blob id of the file's exact bytes, so a pin names the immutable object, not just a checkout.
const gitBlob = (relative) => {
    const bytes = fs.readFileSync(path.join(root, relative));
    return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const PAGE ='interface/patient_file/history/history_full.php';
const CSS = 'interface/clinical-workspace/history-editor.css';
const SCOPE = 'body.oe-clinical-history-editor.oe-clinical-workspace #container_div.oe-history-editor';
const CLEARFIX = `${SCOPE} div#HIS::after`;
const TEMPLATE_LINK = `${SCOPE} div#HIS div.tab .lbfdata a.text-body`;
const FOCUS_RING = { outline: '2px solid var(--oe-petrol)', 'outline-offset': '2px' };

// sha256 at master 5619373a, before this change.
const ORIGINAL = {
    historyFull: '4d3477666fe13eb96b0a2389ed0a48bca5b57c14992d14d20cc67c5ddc87371b',
    historySave: 'ba85d549fefef0d59be6aa4e63218e3ce845762572d0061096628a86ac4d6c75',
    workspaceCss: '0534d5ab77f344a94cf485a5e0cfa6c80a8de7745c3f533694998058d261590c'
};

// Files this editor slice never edits but that other, independently reviewed changes did. Each is
// pinned to the immutable commit, git blob and sha256 that introduced it; the editor's own
// 5619373a pin is kept as `original` for the record.
const UPSTREAM = {
    // History VIEW lane (PR43), developed independently of this editor and now integrated beside it.
    historyView: {
        commit: '539f99685482a00c987942b83a8b6ba02632dc68',
        blob: '5a203fc62495c0cd2c39ce61bcaadc87696af476',
        sha256: '4f16b5b5ee113a7e89fb424fdb489e0f5c21f975175df50ce3cad329ef1b958c',
        original: 'e03c50d90eac4878e258559c968f4b27f331461f3742d104546722533017b8af'
    },
    // Shared mode engine from merged PR #45 (popup parent/opener provenance).
    modeJs: {
        commit: '11509275488d706d5241cb17dad65bbd28139451',
        blob: '811312261fe6359cc4375fffe3a39b01f0920a34',
        sha256: '6a0a4bcfbe040be385376399df95870b9934b8181056fa5fbcd5a7128fcd6573',
        original: '10736b36a4ad44ae3dd0c7a519708bf5957c2d53b88dd2057ec8e791f61f2599'
    },
    // Upstream OpenEMR return-type refactors (#14347, #14392) arriving via the ee94cec7 merge of
    // upstream master 6685e878: native return types only, no change to emitted markup.
    optionsInc: {
        commit: 'ee94cec7a1869c9769f6578031d1d39f68ee53c5',
        blob: 'dcfee530e92db5c12ce6a2e3ea8cdcabb7cb4de0',
        sha256: 'fa65adf79c28958ebc3ce0f0d8dc5a82878e5cf932e86c3222e39a054d6c00f8',
        original: '871990a09b8cb24023d2d876458a0fd6dbd34d5416d4f04868e505046b54f6fb'
    }
};

const WEBROOT = '<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>';
const asset = (name) => `${WEBROOT}/interface/clinical-workspace/${name}?v=<?php echo attr_url($clinicalAssets->version('${name}')); ?>`;
const HEAD_BLOCK = [
    '<?php $clinicalAssets = new \\OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets(); // Screen-only; inert until mode.js finds an active workbench. ?>',
    `<link rel="stylesheet" media="screen" href="${asset('history-editor.css')}">`,
    `<script src="${asset('mode.js')}" defer></script>`,
    ''
].join('\n');

// Each [candidate, original] pair is the whole of an allowed history_full.php change.
const PAGE_EDITS = [
    ['</style>\n' + HEAD_BLOCK, '</style>\n'],
    ['<body class="oe-clinical-history-editor">\n', '<body>\n'],
    [
        '<div id="container_div" class="container-xl mt-3 oe-history-editor">',
        '<div id="container_div" class="container-xl mt-3">'
    ],
    [
        '                <div class="btn-group oe-history-editor-actions">\n',
        '                <div class="btn-group">\n'
    ]
];

function revert(text, edits) {
    return edits.reduce((out, [candidate, original]) => {
        expect(out.split(candidate)).toHaveLength(2);
        return out.replace(candidate, original);
    }, text);
}

const head = () => {
    const source = read(PAGE);
    return source.slice(source.indexOf('<head>'), source.indexOf('</head>'));
};

describe('history_full.php source preservation', () => {
    test('the only changes are the head block, the body class, the container class and the action-group class', () => {
        expect(sha256(revert(read(PAGE), PAGE_EDITS))).toBe(ORIGINAL.historyFull);
    });

    test('the save handler and workspace.css keep their original bytes', () => {
        expect(sha256(read('interface/patient_file/history/history_save.php'))).toBe(ORIGINAL.historySave);
        expect(sha256(read('interface/clinical-workspace/workspace.css'))).toBe(ORIGINAL.workspaceCss);
    });

    test('the History view, the shared mode.js and the layout renderer match their approved upstream source exactly', () => {
        [
            ['interface/patient_file/history/history.php', UPSTREAM.historyView],
            ['interface/clinical-workspace/mode.js', UPSTREAM.modeJs],
            ['library/options.inc.php', UPSTREAM.optionsInc]
        ].forEach(([file, pin]) => {
            expect([file, gitBlob(file), sha256(read(file))]).toEqual([file, pin.blob, pin.sha256]);
        });
    });

    test('the head block follows the page style, so it wins the cascade, and precedes the OemrUI setup', () => {
        const h = head();
        const style = h.indexOf('</style>');
        const block = h.indexOf(HEAD_BLOCK);
        expect(style).toBeGreaterThan(0);
        expect(block).toBe(style + '</style>\n'.length);
        expect(h.indexOf('$arrOeUiSettings = [')).toBeGreaterThan(block + HEAD_BLOCK.length - 1);
        expect(h.indexOf("Header::setupHeader(['datetime-picker', 'common', 'select2'])")).toBeLessThan(block);
    });

    test('the shared workspace.css is not linked, so its body font, canvas and gutters never apply', () => {
        expect(read(PAGE)).not.toMatch(/workspace\.css|soap-|lbf-document\.css|history-document\.css/);
        expect(head().match(/<link\b/g)).toHaveLength(1);
    });

    test('asset versions come from the helper, never from an inline filesystem path in the URL', () => {
        expect(head()).not.toMatch(/filemtime|__DIR__|getProjectDir\(\)\s*\.\s*['"]\/interface\/clinical-workspace/);
        expect(read('src/Common/Assets/ClinicalWorkspaceAssets.php')).toMatch(/\n {8}'history-editor\.css',\n/);
    });

    test('the form, CSRF token, mode field, save/cancel actions and tab renderers keep their exact markup', () => {
        const source = read(PAGE);
        [
            '<form action="history_save.php" id="HIS" name=\'history_form\' method=\'post\' onsubmit="submitme(<?php echo OEGlobalsBag::getInstance()->getBoolean(\'new_validate\') ? 1 : 0;?>,event,\'HIS\',constraints)">',
            '<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />',
            "<input type='hidden' name='mode' value='save' />",
            '<button type="submit" class="btn btn-primary btn-save"><?php echo xlt(\'Save\'); ?></button>',
            '<a href="history.php" class="btn btn-secondary btn-cancel" onclick="top.restoreSession()">',
            "<?php display_layout_tabs('HIS', $result, ($result2 ?? '')); ?>",
            "<?php display_layout_tabs_data_editable('HIS', $result, ($result2 ?? '')); ?>",
            "if (!AclMain::aclCheckCore('patients', 'med', '', ['write','addonly'])) {"
        ].forEach((fragment) => expect(source.split(fragment)).toHaveLength(2));
    });
});

// --- stylesheet ----------------------------------------------------------------------------

function cssRules() {
    const rules = [];
    postcss.parse(readIfPresent(CSS)).walkRules((rule) => rules.push(rule));
    return rules;
}

const decls = (rule) => Object.fromEntries(rule.nodes.filter((n) => n.type === 'decl').map((d) => [d.prop, d.value + (d.important ? ' !important' : '')]));
const ruleFor = (selector) => cssRules().find((candidate) => candidate.selectors.includes(selector));

// Palette tokens are declared by this stylesheet on its own scoped container.
const tokens = () => {
    const rule = ruleFor(SCOPE);
    return rule ? Object.fromEntries(Object.entries(decls(rule)).filter(([p]) => p.startsWith('--'))) : {};
};

function resolveColor(value, vars) {
    const plain = value.replace(/\s*!important$/, '').trim();
    const ref = plain.match(/^var\((--[\w-]+)\)$/);
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

describe('history-editor.css', () => {
    test('every rule is inside @media screen and scoped to the editor container in an active workbench', () => {
        const rules = cssRules();
        expect(rules.length).toBeGreaterThanOrEqual(10);
        for (const rule of rules) {
            expect(rule.parent.type).toBe('atrule');
            expect(`@${rule.parent.name} ${rule.parent.params}`).toBe('@media screen');
            expect(rule.parent.parent.type).toBe('root');
            for (const selector of rule.selectors) {
                expect([selector, selector === SCOPE || selector.startsWith(`${SCOPE} `)]).toEqual([selector, true]);
            }
        }
        expect(readIfPresent(CSS)).not.toMatch(/:has\(|@import|@font-face|width\s*[<>]=?|max-width:\s*\d+px\)/);
    });

    test('the page duplicates id HIS on the form and the tab wrapper, so every #HIS selector names its element', () => {
        const selectors = cssRules().flatMap((rule) => rule.selectors);
        expect(selectors.some((s) => s.includes('form#HIS'))).toBe(true);
        expect(selectors.some((s) => s.includes('div#HIS'))).toBe(true);
        for (const selector of selectors) {
            expect([selector, /(^|[\s>+~])#HIS\b/.test(selector)]).toEqual([selector, false]);
        }
    });

    test('typography is left to the theme and the configured HIS font settings', () => {
        const typography = /^(font|font-[a-z-]+|line-height|letter-spacing|text-transform|word-spacing)$/;
        for (const rule of cssRules()) {
            expect([rule.selector, Object.keys(decls(rule)).filter((p) => typography.test(p))]).toEqual([rule.selector, []]);
        }
    });

    test('no rule hides, disables, positions, floats or sizes anything (the one exception is the float clearfix)', () => {
        const forbidden = /^(display|visibility|pointer-events|opacity|content|resize|float|clear|position|inset|top|right|bottom|left|z-index|width|min-width|height|min-height|max-height|flex|flex-basis|order|transform)$/;
        for (const rule of cssRules()) {
            if (rule.selector === CLEARFIX) continue;
            expect([rule.selector, Object.keys(decls(rule)).filter((p) => forbidden.test(p))]).toEqual([rule.selector, []]);
        }
    });

    test('float containment: the theme floats ul.tabNav and div.tabContainer, so a generated clearfix closes div#HIS', () => {
        expect(read('interface/themes/core/tabs.scss')).toMatch(/ul\.tabNav \{\n\s+float: \$left;[\s\S]*div\.tabContainer \{\n\s+clear: both;\n\s+float: \$left;/);
        const rule = ruleFor(CLEARFIX);
        expect(rule).toBeDefined();
        expect(rule.selectors).toEqual([CLEARFIX]);
        // Exactly the clearfix, on a generated box only: no real element changes display or float.
        expect(decls(rule)).toEqual({ content: "''", display: 'table', clear: 'both' });
    });

    test('!important is used only to re-pair the Bootstrap .text-body utility on custom-template (type 34) fields', () => {
        expect(read('library/options.inc.php')).toContain("class='iframe_medium text-body text-decoration-none'");
        const important = cssRules().flatMap((rule) => Object.entries(decls(rule))
            .filter(([, v]) => v.endsWith('!important')).map(([p, v]) => [rule.selector, p, v]));
        expect(important).toEqual([[TEMPLATE_LINK, 'color', 'var(--oe-ink) !important']]);
        expect(decls(ruleFor(TEMPLATE_LINK))['background-color']).toBe('var(--oe-paper)');
        expect(decls(ruleFor(`${TEMPLATE_LINK} .text-area`))).toEqual({ 'background-color': 'var(--oe-paper)', color: 'var(--oe-ink)' });
    });

    test('palette tokens live on the scoped container, never on the body, and match the workbench palette', () => {
        expect(tokens()).toEqual({
            '--oe-ink': '#17343b',
            '--oe-muted': '#526a70',
            '--oe-line': '#d9e4e2',
            '--oe-paper': '#fff',
            '--oe-petrol': '#086878',
            '--oe-subtle': '#e4eeec'
        });
        expect(Object.keys(decls(ruleFor(SCOPE))).filter((p) => !p.startsWith('--'))).toEqual([]);
    });

    test('every text colour is paired with its own background and meets WCAG AA, so dark themes stay readable', () => {
        const vars = tokens();
        const paired = cssRules().filter((rule) => 'color' in decls(rule));
        expect(paired.length).toBeGreaterThanOrEqual(8);
        for (const rule of paired) {
            const d = decls(rule);
            expect([rule.selector, 'background-color' in d]).toEqual([rule.selector, true]);
            const ratio = contrast(resolveColor(d.color, vars), resolveColor(d['background-color'], vars));
            expect([rule.selector, ratio >= 4.5]).toEqual([rule.selector, true]);
        }
    });

    test('the dark-theme --gray300 subtitle fill is redefined to a light token on the sheet', () => {
        const sheet = decls(ruleFor(`${SCOPE} form#HIS`));
        expect(sheet['--gray300']).toBe('var(--oe-subtle)');
        expect(sheet['background-color']).toBe('var(--oe-paper)');
        expect(sheet.color).toBe('var(--oe-ink)');
    });

    test('320px: tab labels and static values wrap, actions wrap, and no scroll container is introduced', () => {
        expect(decls(ruleFor(`${SCOPE} div#HIS ul.tabNav a`))['overflow-wrap']).toBe('anywhere');
        expect(decls(ruleFor(`${SCOPE} div#HIS div.tab .lbfdata [id^='value_id_']`))).toEqual({ 'overflow-wrap': 'anywhere' });
        expect(decls(ruleFor(`${SCOPE} .oe-history-editor-actions`))).toEqual({ 'flex-wrap': 'wrap', 'max-width': '100%' });
        // No scroll container is introduced: a native run found the focus ring of a control inside a
        // scrolled lifestyle cell clipped, so wide renderer tables keep the original page behaviour.
        const scrollers = cssRules().filter((rule) => Object.keys(decls(rule)).some((p) => /^overflow(-[xy])?$/.test(p)));
        expect(scrollers.map((rule) => rule.selector)).toEqual([]);
    });

    test('the sheet is geometry-neutral: its rule line is an inset shadow, never padding, border or margin', () => {
        // A native run measured +9px horizontal overflow at 390/320 from sheet padding and border.
        const sheet = decls(ruleFor(`${SCOPE} form#HIS`));
        expect(Object.keys(sheet).filter((p) => /^(padding|margin|border)(-|$)/.test(p) && p !== 'border-radius')).toEqual([]);
        expect(sheet['box-shadow']).toBe('inset 0 0 0 1px var(--oe-line), 0 1px 2px rgb(23 52 59 / 6%)');
    });

    test('radios, checkboxes and custom-template links get a visible keyboard focus ring in the sheet', () => {
        const rule = ruleFor(`${SCOPE} div#HIS div.tab input[type='radio']:focus-visible`);
        expect(rule).toBeDefined();
        expect(rule.selectors).toEqual([
            `${SCOPE} div#HIS div.tab input[type='radio']:focus-visible`,
            `${SCOPE} div#HIS div.tab input[type='checkbox']:focus-visible`,
            `${TEMPLATE_LINK}:focus-visible`
        ]);
        expect(decls(rule)).toEqual(FOCUS_RING);
    });

    test('keyboard focus is visible on tabs and both actions (the theme removes the tab outline)', () => {
        [
            `${SCOPE} div#HIS ul.tabNav a:focus-visible`,
            `${SCOPE} .oe-history-editor-actions .btn:focus-visible`
        ].forEach((selector) => {
            expect(decls(ruleFor(selector))).toMatchObject({ outline: '2px solid var(--oe-petrol)' });
        });
    });
});

// --- synthetic renderer fixture -------------------------------------------------------------

// One field per broad control family the HIS layout emits through generate_form_field().
const FIELDS = [
    { id: 'syn_text', control: '<input type="text" name="form_syn_text" id="form_syn_text" size="20" class="form-control form-control-sm mb-1 mw-100" value="SYNTHETIC">' },
    { id: 'syn_date', control: '<input type="text" size="10" class="datepicker form-control form-control-sm mb-1 mw-100" name="form_syn_date" id="form_syn_date" value="2000-01-01">' },
    { id: 'syn_note', control: '<textarea name="form_syn_note" id="form_syn_note" class="form-control form-control-sm mb-1 mw-100" cols="40" rows="3">SYNTHETIC body</textarea>' },
    { id: 'syn_list', control: '<select name="form_syn_list" id="form_syn_list" class="form-control form-control-sm mb-1 mw-100 select-dropdown"><option value="">Unassigned</option><option value="a" selected>SYNTHETIC A</option></select>' },
    {
        id: 'syn_lifestyle',
        control: "<table class='table'><tr><td><input type='text' class='form-control' name='form_syn_lifestyle' id='form_syn_lifestyle' size='20' value='SYNTHETIC' />&nbsp;</td>"
            + "<td class='font-weight-bold'>&nbsp;&nbsp;Status:&nbsp;&nbsp;</td>"
            + "<td class='text'><input type='radio' name='radio_syn_lifestyle' id='radio_syn_lifestyle[current]' class='form-check-inline' value='currentsyn_lifestyle' onclick='return SYNTHETIC(this)' checked />Current&nbsp;</td>"
            + "<td class='text'><input type='radio' name='radio_syn_lifestyle' id='radio_syn_lifestyle[quit]' class='form-check-inline' value='quitsyn_lifestyle' />Quit&nbsp;</td></tr></table>"
    },
    { id: 'syn_check', control: '<input type="checkbox" name="form_syn_check[a]" id="form_syn_check[a]" value="1" checked>SYNTHETIC A' },
    {
        id: 'syn_template',
        control: "<div><a href='../../../library/custom_template/custom_template.php?type=form_syn_template&contextName=' class='iframe_medium text-body text-decoration-none'>"
            + "<div id='form_syn_template_div' class='text-area' style='min-width: 133px'>SYNTHETIC template text</div>"
            + "<div style='display: none'><textarea name='form_syn_template' id='form_syn_template' class='form-control form-control-sm mb-1 mw-100' style='display: none'>SYNTHETIC template text</textarea></div></a></div>"
    }
];

const fieldRows = (fields) => fields.map((f) => "<div class='form-row'>"
    + `<div class='col-sm-3 pt-1 label_custom' id='label_id_${f.id}'>SYNTHETIC ${f.id}:</div>`
    + `<div class='col-sm-9' id='value_id_text_${f.id}'>${f.control}</div></div>\n`).join('');

function page({ routeClass }) {
    return `<div id="container_div" class="container-xl mt-3${routeClass ? ' oe-history-editor' : ''}">
<div class="row"><div class="col-12"><nav id="dashboard-header-synthetic">SYNTHETIC header</nav></div></div>
<div class="row"><div class="col-12">
<form action="history_save.php" id="HIS" name='history_form' method='post' onsubmit="submitme(1,event,'HIS',constraints)">
<input type="hidden" name="csrf_token_form" value="SYNTHETIC-TOKEN" />
<input type='hidden' name='mode' value='save' />
<div class="btn-group${routeClass ? ' oe-history-editor-actions' : ''}">
<button type="submit" class="btn btn-primary btn-save">Save</button>
<a href="history.php" class="btn btn-secondary btn-cancel" onclick="top.restoreSession()">Cancel</a>
</div>
<br/>
<div id="HIS" class="float-none mt-3">
<ul class="tabNav"><li class="current"><a href="#" id="header_tab_General">General</a></li><li><a href="#" id="header_tab_Lifestyle">Lifestyle</a></li></ul>
<div class="tabContainer">
<div class='tab current' id='tab_General'>
<div class='container-fluid lbfdata'>
<div class='row mb-2'><div class='col-sm-12' style='color:#0000ff'>SYNTHETIC subtitle</div></div>
<div class='form-row mb-2'><div class='col-sm-12 p-2 label' style='background-color: var(--gray300)'>SYNTHETIC subtitle</div></div>
${fieldRows(FIELDS.slice(0, 4))}</div>
</div>
<div class='tab' id='tab_Lifestyle'>
<br /><span class='bold'><input type='checkbox' name='form_cb_grp-HIS-2a' value='1' onclick='return divclick(this,"div_grp-HIS-2a");' /><b>SYNTHETIC group</b></span>
<div id='div_grp-HIS-2a' class='section' style='display:none;'>
<div class='container-fluid lbfdata'>
${fieldRows(FIELDS.slice(4))}</div>
</div>
</div>
</div>
</div>
</form>
</div></div>
</div>`;
}

function mount(options) {
    document.body.className = options.routeClass ? 'oe-clinical-history-editor' : '';
    document.body.innerHTML = page(options);
}

// tag, type, name, id, value, checked/selected, inline handlers, action, sizes and classes of every control.
function controls() {
    return [...document.querySelectorAll('form, input, select, textarea, button, option, a')].map((el) => [
        el.tagName, el.getAttribute('type'), el.getAttribute('name'), el.id, el.getAttribute('value'),
        el.hasAttribute('checked') || el.selected === true, el.getAttribute('onclick'), el.getAttribute('onsubmit'),
        el.getAttribute('action'), el.getAttribute('href'), el.getAttribute('size'), el.getAttribute('rows'),
        el.getAttribute('cols'), el.getAttribute('class'), el.tagName === 'TEXTAREA' ? el.value : null
    ].join('|')).sort();
}

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

// Generated boxes (::after) are attributed to their originating element.
const stripState = (selector) => selector.replace(/::after\b/g, '').replace(/:(hover|focus-visible|focus|active)\b/g, '');
const matchedRules = () => cssRules().flatMap((rule) => rule.selectors
    .flatMap((s) => [...document.querySelectorAll(stripState(s))].map((el) => ({ el, rule }))));

describe('SYNTHETIC history editor fixture', () => {
    afterEach(() => {
        document.body.className = '';
        document.body.innerHTML = '';
    });

    test('workbench mode toggles only the body class; every control, value, handler and node is kept', () => {
        mount({ routeClass: true });
        const before = controls();
        const nodes = [...document.querySelectorAll('input, select, textarea, button, a')];
        expect(before.filter((c) => /^(INPUT|SELECT|TEXTAREA)\|/.test(c))).toHaveLength(12);

        const { hostBody, win } = hostWindow(true);
        const { controller, notify } = startMode(win);
        expect(document.body.className).toBe('oe-clinical-history-editor oe-clinical-workspace');
        expect(controls()).toEqual(before);
        expect([...document.querySelectorAll('input, select, textarea, button, a')]).toEqual(nodes);
        expect(document.getElementById('div_grp-HIS-2a').style.display).toBe('none');

        hostBody.classList.remove('workbench-active');
        notify();
        expect(document.body.className).toBe('oe-clinical-history-editor');
        controller.dispose();
        expect(controls()).toEqual(before);
    });

    test('legacy: outside an active workbench the stylesheet is fully inert', () => {
        mount({ routeClass: true });
        startMode(hostWindow(false).win);
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(false);
        expect(matchedRules()).toEqual([]);
    });

    test('another route in an active workbench (no route classes) is untouched', () => {
        mount({ routeClass: false });
        startMode(hostWindow(true).win);
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(true);
        expect(matchedRules()).toEqual([]);
    });

    test('in the workbench the sheet styles the form, tabs, panels and actions but never a field row, label or control', () => {
        mount({ routeClass: true });
        startMode(hostWindow(true).win);
        const matches = matchedRules();
        const form = document.querySelector('form#HIS');
        const tabs = document.querySelector('div#HIS');
        expect(matches.some(({ el }) => el === form)).toBe(true);
        expect(matches.some(({ el }) => el.matches('ul.tabNav a'))).toBe(true);
        expect(matches.some(({ el }) => el.matches('div.tab.current'))).toBe(true);
        expect(matches.some(({ el }) => el.matches('.btn-save'))).toBe(true);
        expect(matches.some(({ el }) => el.matches('.btn-cancel'))).toBe(true);
        // Rules written for the form never reach the tab wrapper that shares its id, and vice versa.
        matches.filter(({ el }) => el === tabs).forEach(({ rule }) => expect(rule.selector).not.toMatch(/form#HIS/));
        matches.filter(({ el }) => el === form).forEach(({ rule }) => expect(rule.selector).not.toMatch(/div#HIS/));
        // Controls are only ever touched by :focus-visible rules that draw an outline; nothing else.
        const controlTags = 'input, select, textarea, option, .form-row, .label_custom, [id^="label_id_"], span.bold, b';
        const focusOnly = (rule) => rule.selectors.every((s) => s.endsWith(':focus-visible'))
            && Object.keys(decls(rule)).every((p) => p === 'outline' || p === 'outline-offset');
        expect(matches.filter(({ el, rule }) => el.matches(controlTags) && !focusOnly(rule)).map(({ rule }) => rule.selector)).toEqual([]);
    });

    test('nested lifestyle tables and group panels take the sheet ink on paper; Bootstrap semantic tables do not', () => {
        mount({ routeClass: true });
        startMode(hostWindow(true).win);
        const semantic = document.createElement('table');
        semantic.className = 'table table-danger';
        document.querySelector('#value_id_text_syn_lifestyle').appendChild(semantic);
        const surfaces = (el) => matchedRules().filter((m) => m.el === el && 'background-color' in decls(m.rule));
        expect(surfaces(document.querySelector("#value_id_text_syn_lifestyle > table.table:not([class*='table-'])"))).not.toHaveLength(0);
        expect(surfaces(document.querySelector('#div_grp-HIS-2a'))).not.toHaveLength(0);
        expect(surfaces(semantic)).toEqual([]);
    });

    test('a populated custom-template (type 34) field gets sheet ink over its own paper surface', () => {
        mount({ routeClass: true });
        startMode(hostWindow(true).win);
        const link = document.querySelector('#value_id_text_syn_template a.text-body');
        const area = document.getElementById('form_syn_template_div');
        const colourRules = (el) => matchedRules().filter((m) => m.el === el && 'color' in decls(m.rule)).map((m) => decls(m.rule));
        expect(colourRules(link)).toEqual([{ color: 'var(--oe-ink) !important', 'background-color': 'var(--oe-paper)' }]);
        expect(colourRules(area)).toEqual([{ 'background-color': 'var(--oe-paper)', color: 'var(--oe-ink)' }]);
        expect(document.getElementById('form_syn_template').style.display).toBe('none');
    });

    test('no value cell becomes a scroll container (focus rings are never clipped by the sheet)', () => {
        mount({ routeClass: true });
        startMode(hostWindow(true).win);
        const scrolls = matchedRules().filter((m) => Object.keys(decls(m.rule)).some((p) => p.startsWith('overflow-') && p !== 'overflow-wrap'));
        expect(scrolls).toEqual([]);
    });
});
