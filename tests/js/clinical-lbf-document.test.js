/**
 * @jest-environment jsdom
 */
/* global __dirname */

// LBF visit forms (interface/forms/LBF/new.php, also reached through view.php) as a document
// inside the clinical workbench. The production change is presentation only: a guarded head
// block that loads workspace.css, lbf-document.css and the shared mode.js, a route body class,
// and two wrapper classes. These tests pin that nothing else in new.php changed, that the
// stylesheet is screen-only and inert outside an active workbench, and that it never targets
// the sizing or visibility of LBF controls in either the Bootstrap or the legacy table renderer.
//
// The DOM fixtures below are SYNTHETIC. They copy the element structure and class names that
// new.php writes for each renderer; they are not rendered by PHP, carry no patient data and
// stand in for neither the database nor ACL behaviour.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const postcss = require('postcss');
const { createModeController } = require('../../interface/clinical-workspace/mode.js');

const root = path.join(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
// The stylesheet is read leniently so its absence fails the content assertions, not the loader.
const readIfPresent = (relative) => (fs.existsSync(path.join(root, relative)) ? read(relative) : '');
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

const NEW = 'interface/forms/LBF/new.php';
const VIEW = 'interface/forms/LBF/view.php';
const CSS = 'interface/clinical-workspace/lbf-document.css';
const SCOPE = 'body.oe-clinical-lbf.oe-clinical-workspace .oe-lbf-document';

// sha256 at master bcf11c6, before this change.
const ORIGINAL = {
    newPhp: 'd648c93bc7035ba8ff59edf40131cbec923c41551e1b601b6cabc74e643ebf31',
    viewPhp: '17b54f5571222d16add2cf07633b8ed7f80a0e5ec2267f7993495940848efe1d',
    modeJs: '6a0a4bcfbe040be385376399df95870b9934b8181056fa5fbcd5a7128fcd6573',
    workspaceCss: 'e0a3157173a255e448183856804215b678840de3bc63c18227a7e34d78b1f16e'
};

const WEBROOT = '<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>';
const asset = (name) => `${WEBROOT}/interface/clinical-workspace/${name}?v=<?php echo attr_url($clinicalAssets->version('${name}')); ?>`;
const HEAD_BLOCK = [
    '    <?php if ($lbf_workbench_document) { // Screen-only; inert until mode.js finds an active workbench. ?>',
    '        <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>',
    `        <link rel="stylesheet" media="screen" href="${asset('workspace.css')}">`,
    `        <link rel="stylesheet" media="screen" href="${asset('lbf-document.css')}">`,
    `        <script src="${asset('mode.js')}" defer></script>`,
    '    <?php } ?>',
    ''
].join('\n');

// Each [candidate, original] pair is the whole of an allowed new.php change.
const NEW_EDITS = [
    // The first PHP opening tag moved one column in the new body class; align its closing tag.
    ['                     } ?>>', '                      } ?>>'],
    [
        'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n',
        'use OpenEMR\\Common\\Acl\\AclMain;\n'
    ],
    [
        '$is_core = !($portal_form_pid || $patient_portal || $is_portal_dashboard || $is_portal_module);\n'
            + '// Workbench document presentation is limited to staff encounter forms. Portal, issue-form tab\n'
            + '// and trend/graph pages keep their own presentation.\n'
            + '$lbf_workbench_document = $is_core && !$from_issue_form && !$from_trend_form;\n',
        '$is_core = !($portal_form_pid || $patient_portal || $is_portal_dashboard || $is_portal_module);\n'
    ],
    ['    </style>\n' + HEAD_BLOCK, '    </style>\n'],
    [
        '<body class="body_top<?php echo $lbf_workbench_document ? \' oe-clinical-lbf\' : \'\'; ?>"<?php if ($from_issue_form) {',
        '<body class="body_top"<?php if ($from_issue_form) {'
    ],
    ['    <div class="container-xl oe-lbf-document">\n', '    <div class="container-xl">\n'],
    [
        "                <div class='row oe-lbf-actions'>\n                    <div class='col-12'>\n                        <div class=\"btn-group\">",
        "                <div class='row'>\n                    <div class='col-12'>\n                        <div class=\"btn-group\">"
    ]
];

function revert(text, edits) {
    return edits.reduce((out, [candidate, original]) => {
        expect(out.split(candidate)).toHaveLength(2);
        return out.replace(candidate, original);
    }, text);
}

// workspace.css is shared with the patient record, which appends its own secondary dashboard
// card rules after the original stylesheet. The original text must survive byte for byte, and
// every appended rule must be screen-only and scoped to the patient record body, so it can never
// reach an LBF document body (body_top oe-clinical-lbf oe-clinical-workspace).
const WORKSPACE_CSS = 'interface/clinical-workspace/workspace.css';
const RECORD_APPENDIX = '\n/*\n * Secondary dashboard cards:';
const RECORD_SCOPE = 'body.oe-clinical-record.oe-clinical-workspace';
const RECORD_MEDIA = ['screen', 'screen and (width <= 640px)'];
const LBF_BODY_CLASS = 'body_top oe-clinical-lbf oe-clinical-workspace';

function splitWorkspaceCss(text) {
    const at = text.indexOf(RECORD_APPENDIX);
    if (at === -1) {
        return { original: text, appended: '' };
    }
    if (text.indexOf(RECORD_APPENDIX, at + 1) !== -1) {
        throw new Error('workspace.css: patient-record appendix marker appears more than once');
    }
    return { original: text.slice(0, at), appended: text.slice(at) };
}

function verifyWorkspaceCss(text) {
    const { original, appended } = splitWorkspaceCss(text);
    if (sha256(original) !== ORIGINAL.workspaceCss) {
        throw new Error('workspace.css: original shared stylesheet changed');
    }
    const lbfBody = document.implementation.createHTMLDocument('').body;
    lbfBody.className = LBF_BODY_CLASS;
    postcss.parse(appended).each((node) => {
        if (node.type === 'comment') {
            return;
        }
        if (node.type !== 'atrule' || node.name !== 'media' || !RECORD_MEDIA.includes(node.params)) {
            throw new Error(`workspace.css: appended ${node.type} is outside a screen media block`);
        }
        node.each((child) => {
            if (child.type === 'comment') {
                return;
            }
            if (child.type !== 'rule') {
                throw new Error(`workspace.css: appended @media ${node.params} nests a ${child.type}`);
            }
            child.selectors.forEach((selector) => {
                const head = selector.split(/[\s>+~]/, 1)[0];
                if (head !== RECORD_SCOPE || !/^\s+\S/.test(selector.slice(head.length))) {
                    throw new Error(`workspace.css: appended selector is not patient-record scoped: ${selector}`);
                }
                if (selector.includes('oe-clinical-lbf') || lbfBody.matches(head)) {
                    throw new Error(`workspace.css: appended selector can match the LBF body: ${selector}`);
                }
            });
        });
    });
}

describe('LBF new.php source preservation', () => {
    test('the only changes are the import, the guard, the head block, the body class and two wrapper classes', () => {
        expect(sha256(revert(read(NEW), NEW_EDITS))).toBe(ORIGINAL.newPhp);
    });

    test('view.php still routes to new.php unchanged; mode.js is reused unchanged; workspace.css keeps its original rules', () => {
        expect(sha256(read(VIEW))).toBe(ORIGINAL.viewPhp);
        expect(read(VIEW)).toContain('require("new.php");');
        expect(sha256(read('interface/clinical-workspace/mode.js'))).toBe(ORIGINAL.modeJs);
        expect(() => verifyWorkspaceCss(read(WORKSPACE_CSS))).not.toThrow();
    });

    test('the head block sits after setupHeader and the page style, ahead of every head script', () => {
        const source = read(NEW);
        const head = source.slice(source.indexOf('<head>'), source.indexOf('</head>'));
        const setup = head.indexOf("Header::setupHeader(['opener', 'common', 'datetime-picker', 'select2'])");
        const block = head.indexOf(HEAD_BLOCK);
        expect(setup).toBeGreaterThan(0);
        expect(block).toBeGreaterThan(setup);
        expect(head.indexOf('<script', block + HEAD_BLOCK.length)).toBeGreaterThan(block);
        expect(head.slice(0, block)).not.toMatch(/<script\b/);
    });

    test('asset versions come from the helper, never from an inline filesystem path in the URL', () => {
        const source = read(NEW);
        const head = source.slice(source.indexOf('<head>'), source.indexOf('</head>'));
        expect(head).toContain(HEAD_BLOCK);
        expect(head).not.toMatch(/filemtime|__DIR__|getProjectDir\(\)\s*\.\s*['"]\/interface\/clinical-workspace/);
        expect(read('src/Common/Assets/ClinicalWorkspaceAssets.php')).toMatch(/\n {8}'lbf-document\.css',\n/);
    });
});

// --- stylesheet ----------------------------------------------------------------------------

function cssRules() {
    const rules = [];
    postcss.parse(readIfPresent(CSS)).walkRules((rule) => rules.push(rule));
    return rules;
}

const decls = (rule) => Object.fromEntries(rule.nodes.filter((n) => n.type === 'decl').map((d) => [d.prop, d.value + (d.important ? ' !important' : '')]));

const workspaceVars = () => Object.fromEntries(
    [...read('interface/clinical-workspace/workspace.css').match(/body\.oe-clinical-workspace\s*{([^}]*)}/)[1]
        .matchAll(/(--oe-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
);

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

describe('workspace.css shared-stylesheet verifier', () => {
    const current = () => read(WORKSPACE_CSS);
    const firstRule = `${RECORD_SCOPE} .oe-card-details {`;

    test('the original stylesheet is an exact prefix and the appendix is patient-record only', () => {
        const { original, appended } = splitWorkspaceCss(current());
        expect(original.endsWith('}\n')).toBe(true);
        expect(sha256(original)).toBe(ORIGINAL.workspaceCss);
        expect(appended.startsWith(RECORD_APPENDIX)).toBe(true);
        expect(() => verifyWorkspaceCss(current())).not.toThrow();
    });

    test('the original stylesheet alone still verifies', () => {
        expect(() => verifyWorkspaceCss(splitWorkspaceCss(current()).original)).not.toThrow();
    });

    test('changing an original declaration fails', () => {
        const { original, appended } = splitWorkspaceCss(current());
        const edited = original.replace(/:\s*([^;{}]+);/, ': inherit;');
        expect(edited).not.toBe(original);
        expect(() => verifyWorkspaceCss(edited + appended)).toThrow(/original shared stylesheet changed/);
    });

    test('moving the appendix boundary fails', () => {
        const text = current().replace(RECORD_APPENDIX, `\n.x { color: red; }${RECORD_APPENDIX}`);
        expect(() => verifyWorkspaceCss(text)).toThrow(/original shared stylesheet changed/);
    });

    test.each([
        ['broadened to any workspace', 'body.oe-clinical-workspace .oe-card-details {', /not patient-record scoped/],
        ['retargeted to the LBF body', 'body.oe-clinical-lbf.oe-clinical-workspace .oe-card-details {', /not patient-record scoped/],
        ['made global', '.oe-card-details {', /not patient-record scoped/],
        ['joined to a global selector', `${RECORD_SCOPE} .oe-card-details, .oe-card-details {`, /not patient-record scoped/],
        ['applied to the body itself', `${RECORD_SCOPE} {`, /not patient-record scoped/],
        ['extended with an LBF compound', `${RECORD_SCOPE}.oe-clinical-lbf .oe-card-details {`, /not patient-record scoped/],
        ['combined with an LBF descendant', `${RECORD_SCOPE} .oe-clinical-lbf .oe-card-details {`, /can match the LBF body/]
    ])('a new patient selector %s fails', (_label, replacement, message) => {
        expect(current()).toContain(firstRule);
        expect(() => verifyWorkspaceCss(current().replace(firstRule, replacement))).toThrow(message);
    });

    test.each([
        ['an unscoped media block', '@media screen {', '@media all {'],
        ['a print media block', '@media screen {', '@media print {']
    ])('moving appended rules into %s fails', (_label, from, to) => {
        const { original, appended } = splitWorkspaceCss(current());
        expect(appended).toContain(from);
        expect(() => verifyWorkspaceCss(original + appended.replace(from, to))).toThrow(/outside a screen media block/);
    });

    test('an appended top-level rule fails', () => {
        expect(() => verifyWorkspaceCss(`${current()}\n${RECORD_SCOPE} .x { color: red; }\n`))
            .toThrow(/outside a screen media block/);
    });

    test('a nested at-rule inside appended media fails', () => {
        const text = current().replace(firstRule, `@media print { ${RECORD_SCOPE} .x { color: red; } }\n  ${firstRule}`);
        expect(() => verifyWorkspaceCss(text)).toThrow(/nests a atrule/);
    });
});

describe('lbf-document.css', () => {
    test('nested date/gestational-age tables pair their ink with the document surface', () => {
        const source = read('library/options.inc.php');
        expect(source).toContain("<table class='table'><tr><td class='text'>");
        const rule = cssRules().find((candidate) => candidate.selectors.includes(`${SCOPE} .lbfdata table.table:not([class*='table-'])`));
        expect(rule).toBeDefined();
        expect(decls(rule)).toMatchObject({ color: 'var(--oe-ink)', 'background-color': 'var(--oe-paper)' });
    });
    test('table-level Bootstrap semantic variants do not acquire the age-table neutral surface', () => {
        document.body.className = 'oe-clinical-lbf oe-clinical-workspace';
        // Constant synthetic markup and fixed variant names only; no external/clinical input.
        document.body.innerHTML = '<div class="oe-lbf-document"><div class="lbfdata">'
            + '<table class="table" id="age-table"><tr><td class="text">SYNTHETIC age</td></tr></table>'
            + ['danger', 'warning', 'success', 'info', 'primary', 'secondary', 'light', 'dark', 'active']
                .map((variant) => `<table class="table table-${variant}" data-semantic="${variant}"><tr><td>SYNTHETIC status</td></tr></table>`).join('')
            + '</div></div>';
        const surfaceRules = cssRules().filter((candidate) => 'background-color' in decls(candidate));
        const matches = (element) => surfaceRules.flatMap((candidate) => candidate.selectors).filter((selector) => element.matches(selector));
        expect(matches(document.getElementById('age-table'))).not.toHaveLength(0);
        document.querySelectorAll('[data-semantic]').forEach((table) => expect(matches(table)).toEqual([]));
    });
    test('document framing preserves renderer gutters and does not shrink headings or field labels', () => {
        const rule = (selector) => cssRules().find((candidate) => candidate.selectors.includes(selector));
        expect(decls(rule(SCOPE))).toMatchObject({ 'font-size': '1rem', outline: '1px solid var(--oe-line)' });
        expect(decls(rule(`${SCOPE} h3`))['font-size']).toBe('1.75rem');
        expect(decls(rule(`${SCOPE} div.section`))).toMatchObject({ padding: '0.4375rem', 'border-left': '1px solid var(--oe-petrol)' });
        expect(decls(rule(`${SCOPE} .oe-lbf-actions .btn-group`))).toMatchObject({ 'flex-wrap': 'wrap', 'max-width': '100%' });
    });
    test('every rule is inside @media screen and scoped to the LBF document in an active workbench', () => {
        const rules = cssRules();
        expect(rules.length).toBeGreaterThanOrEqual(6);
        for (const rule of rules) {
            expect(rule.parent.type).toBe('atrule');
            expect(`@${rule.parent.name} ${rule.parent.params}`).toBe('@media screen');
            expect(rule.parent.parent.type).toBe('root');
            for (const selector of rule.selectors) {
                expect(selector.startsWith(SCOPE)).toBe(true);
            }
        }
        expect(readIfPresent(CSS)).not.toMatch(/:has\(|@import|width\s*[<>]=?|max-width:\s*\d+px\)/);
    });

    test('no rule hides, disables, resizes or re-flows a control', () => {
        const forbidden = ['display', 'visibility', 'pointer-events', 'opacity', 'content', 'resize', 'float', 'position'];
        for (const rule of cssRules()) {
            for (const prop of Object.keys(decls(rule))) {
                expect(forbidden).not.toContain(prop);
            }
        }
    });

    test('!important is used only to re-pair the Bootstrap .text-primary utility on the sheet', () => {
        const important = cssRules().flatMap((rule) => Object.entries(decls(rule))
            .filter(([, v]) => v.endsWith('!important')).map(([p, v]) => [rule.selector, p, v]));
        expect(important).toEqual([
            [`${SCOPE} .lbfdata .text-primary`, 'color', 'var(--oe-petrol) !important']
        ]);
    });

    test('every text colour is paired with its own background and meets WCAG AA', () => {
        const vars = workspaceVars();
        const paired = cssRules().filter((rule) => 'color' in decls(rule));
        expect(paired.length).toBeGreaterThanOrEqual(4);
        for (const rule of paired) {
            const d = decls(rule);
            expect([rule.selector, 'background-color' in d]).toEqual([rule.selector, true]);
            const ratio = contrast(resolveColor(d.color, vars), resolveColor(d['background-color'], vars));
            expect([rule.selector, ratio >= 4.5]).toEqual([rule.selector, true]);
        }
    });
});

// --- synthetic renderer fixtures ------------------------------------------------------------

const SYNTHETIC_ACTION = '/openemr/interface/forms/LBF/new.php?formname=LBFsynthetic&amp;id=0&amp;formOrigin=&amp;isPortal=0';

// One field per broad control family LBF layouts emit through generate_form_field().
const FIELDS = [
    { id: 'syn_text', label: 'SYNTHETIC text', control: '<input type="text" class="form-control form-control-sm mw-100" name="form_syn_text" id="form_syn_text" size="20" maxlength="255" title="" value="SYNTHETIC value">' },
    { id: 'syn_date', label: 'SYNTHETIC date', control: '<input type="text" size="10" class="datepicker form-control form-control-sm mw-100" name="form_syn_date" id="form_syn_date" value="2000-01-01" title="yyyy-mm-dd">' },
    { id: 'syn_note', label: 'SYNTHETIC note', required: true, control: '<textarea name="form_syn_note" id="form_syn_note" title="" class="form-control form-control-sm mw-100" cols="40" rows="4" maxlength="65535">SYNTHETIC text body</textarea>' },
    { id: 'syn_list', label: 'SYNTHETIC list', control: '<select name="form_syn_list" id="form_syn_list" class="form-control form-control-sm mw-100" title=""><option value="">Unassigned</option><option value="a" selected>SYNTHETIC A</option><option value="b">SYNTHETIC B</option></select>' },
    { id: 'syn_check', label: 'SYNTHETIC check', control: '<label class="checkbox-inline"><input type="checkbox" name="form_syn_check[a]" id="form_syn_check[a]" value="1" checked>SYNTHETIC A</label>' },
    { id: 'syn_radio', label: 'SYNTHETIC radio', control: '<span><input type="radio" name="form_syn_radio" id="form_syn_radio[y]" value="y" checked>Y</span><span><input type="radio" name="form_syn_radio" id="form_syn_radio[n]" value="n">N</span>' },
    { id: 'syn_hidden', label: '', control: '<input type="hidden" name="form_syn_hidden" id="form_syn_hidden" value="SYNTHETIC">' }
];

const groupToggle = (seq, title, open) =>
    `<br><span><label class='mb-1 justify-content-start' role='button'><input class='mr-1' type='checkbox' name='form_cb_${seq}' value='1' onclick='return divclick(this,"div_${seq}");'${open ? ' checked' : ''} /><strong>${title}</strong></label></span>\n`
    + `<div id='div_${seq}' class='section clearfix' style='display:${open ? 'block' : 'none'};'>\n`;

function bootstrapGroup(seq, title, open, fields) {
    const rows = fields.map((f) => `<div class='form-row${f.required ? ' RS' : ''}'>`
        + `<div class='col-sm-6 pt-1 text-wrap${f.required ? ' required' : ' font-weight-bold'}' id='label_id_${f.id}'>${f.label ? `${f.label}:` : '&nbsp;'}</div>`
        + `<div class='col-sm-6 pt-1 text' id='value_id_${f.id}'>${f.control}</div></div><!-- End BS row -->\n`).join('');
    return groupToggle(seq, title, open)
        + " <div class='container-fluid lbfdata'>\n"
        + "<div class='row mb-2'><div class='col-sm-12 font-weight-bold text-primary'>SYNTHETIC subtitle</div></div>\n"
        + rows + ' </div>\n</div>\n';
}

function tableGroup(seq, title, open, fields) {
    const history = "<td colspan='2' class='font-weight-bold border-top-0 text-right'>&nbsp;2000-01-01</td>\n";
    const rows = fields.map((f) => " <tr>"
        + `<td class='border-top-0 align-top text-wrap${f.required ? ' required' : ' font-weight-bold'}' colspan='1' id='label_id_${f.id}'>${f.label ? `${f.label}:` : '&nbsp;'}</td>`
        + `<td colspan='1' class='border-top-0 align-top text' id='value_id_${f.id}'>${f.control}</td>`
        + "<td colspan='1' class='text border-top-0 align-top text-nowrap'></td>"
        + `<td colspan='1' class='text border-top-0 align-top text-right'>SYNTHETIC history</td></tr>\n`).join('');
    return groupToggle(seq, title, open)
        + " <table cellspacing='0' cellpadding='0' class='border-0 lbfdata'>\n"
        + "<tr><td class='font-weight-bold border-top-0 text-primary' colspan='2'>SYNTHETIC subtitle</td></tr>\n"
        + " <tr><td colspan='2' class='font-weight-bold border-top-0 text-right'>2000-01-02 (Current)&nbsp;</td>\n" + history + ' </tr>'
        + rows + ' </table>\n</div>\n';
}

function page({ renderer }) {
    const group = renderer === 'bootstrap' ? bootstrapGroup : tableGroup;
    return `<div class="container-xl oe-lbf-document">
<form method='post' class='form-inline' action='${SYNTHETIC_ACTION}' onsubmit='return validate(this)'>
<div class="row w-100 overflow-auto"><div class="col-12">
<div class="row"><div class="col-12"><h3>SYNTHETIC Form for SYNTHETIC Patient on 2000-01-02</h3>
&nbsp;&nbsp;Provider: <select class='form-control' name='form_provider_id'><option value=''>-- Please Select --</option><option value='1' selected>SYNTHETIC Provider</option></select>
</div></div>
<div id="chart"></div>
${group('lbf1', 'SYNTHETIC Open Group', true, FIELDS.slice(0, 4))}${group('lbf2', 'SYNTHETIC Closed Group', false, FIELDS.slice(4))}
<br />
<div class='row oe-lbf-actions'><div class='col-12'><div class="btn-group">
<button type="submit" class="btn btn-primary btn-save" name="bn_save" onclick='submitButtonName = this.name;' value="Save">Save</button>
<button type='submit' class="btn btn-secondary" name='bn_save_continue' onclick='submitButtonName = this.name;' value='Save and Continue'>Save and Continue</button>
<button type='submit' class="btn btn-secondary" name='bn_save_print' onclick='submitButtonName = this.name;' value='Save and Print'>Save and Print</button>
<button type='button' class="btn btn-secondary btn-cancel" onclick="verifyCancel()">Cancel</button>
</div></div></div>
<hr>
<p style='text-align:center' class='small'>Rev. 2000-01-01</p>
<input type='hidden' name='from_issue_form' value='' />
</div></div>
</form>
</div>`;
}

function mount(options) {
    document.body.className = options.routeClass ? 'body_top oe-clinical-lbf' : 'body_top';
    document.body.innerHTML = page(options);
}

// tag, type, name, id, value, checked, selected options and inline handlers of every control.
function controls() {
    return [...document.querySelectorAll('form, input, select, textarea, button, option')].map((el) => [
        el.tagName, el.getAttribute('type'), el.getAttribute('name'), el.id, el.getAttribute('value'),
        el.hasAttribute('checked') || el.selected === true, el.getAttribute('onclick'), el.getAttribute('onsubmit'),
        el.getAttribute('action'), el.getAttribute('size'), el.getAttribute('rows'), el.getAttribute('cols'),
        el.getAttribute('class'), el.tagName === 'TEXTAREA' ? el.value : null
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

const stripState = (selector) => selector.replace(/:(hover|focus-visible|focus|active)\b/g, '');
const matchedRules = () => cssRules().flatMap((rule) => rule.selectors
    .flatMap((s) => [...document.querySelectorAll(stripState(s))].map((el) => ({ el, rule }))));

describe.each(['bootstrap', 'table'])('SYNTHETIC %s renderer fixture', (renderer) => {
    afterEach(() => {
        document.body.className = '';
        document.body.innerHTML = '';
    });

    test('workbench mode toggles only the body class; every control, value and node is kept', () => {
        mount({ renderer, routeClass: true });
        const before = controls();
        const nodes = [...document.querySelectorAll('input, select, textarea, button')];
        expect(before.filter((c) => c.startsWith('INPUT|') || c.startsWith('SELECT|') || c.startsWith('TEXTAREA|')).length).toBe(12);

        const { hostBody, win } = hostWindow(true);
        const { controller, notify } = startMode(win);
        expect(document.body.className).toBe('body_top oe-clinical-lbf oe-clinical-workspace');
        expect(controls()).toEqual(before);
        expect([...document.querySelectorAll('input, select, textarea, button')]).toEqual(nodes);
        expect(document.getElementById('div_lbf2').style.display).toBe('none');
        expect(document.getElementById('div_lbf1').style.display).toBe('block');

        hostBody.classList.remove('workbench-active');
        notify();
        expect(document.body.className).toBe('body_top oe-clinical-lbf');
        controller.dispose();
        expect(controls()).toEqual(before);
    });

    test('false workbench: an ancestor without workbench-active leaves the stylesheet fully inert', () => {
        mount({ renderer, routeClass: true });
        const { win } = hostWindow(false);
        startMode(win);
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(false);
        expect(matchedRules()).toEqual([]);
    });

    test('portal / issue-form / trend pages (no route class) stay inert even inside an active workbench', () => {
        mount({ renderer, routeClass: false });
        const { win } = hostWindow(true);
        startMode(win);
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(true);
        expect(matchedRules()).toEqual([]);
    });

    test('in the workbench the sheet styles structure but never sizes controls, history cells or show/hide sections', () => {
        mount({ renderer, routeClass: true });
        startMode(hostWindow(true).win);
        const matches = matchedRules();
        expect(matches.some(({ el }) => el.classList.contains('oe-lbf-document'))).toBe(true);
        expect(matches.some(({ el }) => el.matches('div.section'))).toBe(true);

        const geometry = /^(width|min-width|max-width|height|min-height|max-height|flex|flex-basis|white-space|text-align|line-height|font-size|padding|padding-[a-z]+|margin|margin-[a-z]+|box-sizing|overflow|overflow-[xy])$/;
        for (const { el, rule } of matches) {
            const props = Object.keys(decls(rule));
            if (el.matches('input, select, textarea, option, td, th, tr, .form-row, [id^="value_id_"], [id^="label_id_"]')) {
                expect([rule.selector, props.filter((p) => geometry.test(p))]).toEqual([rule.selector, []]);
            }
            if (el.matches('div.section')) {
                expect(props).not.toContain('display');
            }
        }
        // Required labels keep the theme's alert colour; the sheet sets no colour on label cells.
        const labelColours = matches.filter(({ el, rule }) => el.matches('[id^="label_id_"]') && 'color' in decls(rule));
        expect(labelColours).toEqual([]);
    });
});
