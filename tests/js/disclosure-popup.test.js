/** @jest-environment node */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const process = require('node:process');
const postcss = require('postcss');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const ROUTE = 'interface/patient_file/summary/record_disclosure.php';
const LAUNCHER = 'interface/patient_file/summary/disclosure_full.php';
const SHEET = 'interface/clinical-workspace/disclosure-popup.css';
const css = () => read(SHEET);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const count = (text, part) => text.split(part).length - 1;

// sha256 of record_disclosure.php at master 18647270, before the workbench presentation edits.
const BASELINE = 'cbfda3d874848550af79b8729731b0e91dbe41dd01e55b2dabd6d7020f53897e';

const link = '<?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n'
    + '<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/disclosure-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'disclosure-popup.css\')); ?>">\n';

// Every edit is [original, presented]: one use line, one versioned link, and classes on existing elements.
const changes = [
    ['use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;',
        'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;'],
    ["<?php Header::setupHeader(['datetime-picker', 'opener']); ?>\n",
        `<?php Header::setupHeader(['datetime-picker', 'opener']); ?>\n${link}`],
    ['<body>\n    <div class="container" id="record-disclosure">\n        <div class="row">\n            <div class="col-12">',
        '<body class="oe-disclosure-editor">\n    <div class="container oe-disclosure-sheet" id="record-disclosure">\n        <div class="row">\n            <div class="col-12 oe-disclosure-header">'],
    ['<h2 class="title"><?php echo xlt(\'Edit Disclosure\'); ?></h2>',
        '<h2 class="title oe-disclosure-title"><?php echo xlt(\'Edit Disclosure\'); ?></h2>'],
    ['<span class="title"><?php echo xlt(\'Record Disclosure\'); ?></span>',
        '<span class="title oe-disclosure-title"><?php echo xlt(\'Record Disclosure\'); ?></span>'],
    ['<form name="disclosure_form" id="disclosure_form" method="POST" action="disclosure_full.php">',
        '<form name="disclosure_form" id="disclosure_form" class="oe-disclosure-form" method="POST" action="disclosure_full.php">'],
    ['<div class="btn-group">\n                        <button class=\'btn btn-primary btn-save\'',
        '<div class="btn-group oe-disclosure-actions">\n                        <button class=\'btn btn-primary btn-save\''],
    ...['Date', 'Type of Disclosure', 'Recipient of the Disclosure', 'Description of the Disclosure'].map(label => [
        `<div class="form-group mt-3">\n                        <label><?php echo xlt('${label}'); ?>:</label>`,
        `<div class="form-group mt-3 oe-disclosure-field">\n                        <label><?php echo xlt('${label}'); ?>:</label>`,
    ]),
];

// Undo the presentation edits; returns null when any edit is missing or ambiguous.
const restore = text => {
    let restored = text;
    for (const [before, after] of changes) {
        if (count(restored, after) !== 1) return null;
        restored = restored.replace(after, () => before);
    }
    return restored;
};

describe('record_disclosure.php carries only the declared presentation edits', () => {
    test('reversing the declared asset and class edits restores the exact original route', () => {
        const php = read(ROUTE);
        for (const [, after] of changes) expect(count(php, after)).toBe(1);
        expect(sha(restore(php))).toBe(BASELINE);
    });

    test('the sheet is linked once, screen only, versioned through the asset helper after the theme', () => {
        const php = read(ROUTE);
        expect(count(php, 'disclosure-popup.css')).toBe(2);
        expect(count(php, link)).toBe(1);
        expect(php).not.toMatch(/disclosure-popup\.css\?v=(?!<\?php echo attr_url\(\$clinicalAssets)/);
        // The shared workspace sheet changes inherited typography and print; it is never linked here.
        expect(php).not.toMatch(/clinical-workspace\/(workspace|popup)\.css/);
        expect(php.indexOf('disclosure-popup.css')).toBeGreaterThan(php.indexOf('Header::setupHeader('));
        expect(php.match(/<body[ >]/g)).toHaveLength(1);
        expect(php).not.toMatch(/media="print"|@media print/);
    });

    test('the real Record and Edit launchers still open this route in a dlgopen iframe and reload on refreshme', () => {
        const launcher = read(LAUNCHER);
        expect(launcher).toContain('<a href="record_disclosure.php" class="btn btn-primary iframe" onclick="top.restoreSession()">');
        expect(launcher).toContain("<a href='record_disclosure.php?editlid=<?php echo attr_url($iter['id']); ?>' class='btn btn-primary btn-sm btn-edit iframe' onclick='top.restoreSession()'>");
        expect(launcher).toMatch(/dlgopen\('', '', 500, 310, '', '', \{\n\s+allowResize: true,\n\s+allowDrag: true,\n\s+dialogId: '',\n\s+type: 'iframe',\n\s+url: \$\(this\)\.attr\('href'\)\n\s+\}\);/);
        expect(launcher).toContain('function refreshme() {\n    top.restoreSession();\n    document.location.reload();\n}');
        // The launcher is not part of this slice: byte-identical to master 18647270.
        expect(sha(launcher)).toBe('354ead16f2ec8580b17c260c42fc5fb3f9e4e84acaa36e5de93f05680e5790f3');
    });
});

test('negative controls: ACL, addonly guard, SQL, session, CSRF, AJAX, callbacks, controls or datepicker cannot change unnoticed', () => {
    const mutations = [
        ["AclMain::aclCheckCore('patients', 'disclosure', '', 'write')", "AclMain::aclCheckCore('patients', 'disclosure')"],
        ["AclMain::aclCheckCore('patients', 'disclosure', '', 'addonly')", "AclMain::aclCheckCore('patients', 'disclosure', '', 'write')"],
        ['if (!$authWrite && !$authAddonly) {', 'if (!$authWrite || !$authAddonly) {'],
        ["if (isset($_GET['editlid'])) {\n    if (!$authWrite) {", "if (isset($_GET['editlid'])) {\n    if (false) {"],
        ['select date,recipient,description,event from extended_log where id=?', 'select * from extended_log where id=?'],
        ['SessionWrapperFactory::getInstance()->getActiveSession()', 'SessionWrapperFactory::getInstance()->getSession()'],
        ['CsrfUtils::collectCsrfToken(session: $session)', "''"],
        ['name="csrf_token_form"', 'name="csrf_token"'],
        ["dlgclose('refreshme', false);", 'dlgclose();'],
        ['event.preventDefault(); //prevent default action', '//prevent default action'],
        ['var form_data = $(this).serialize();', 'var form_data = {};'],
        ["onclick='top.restoreSession();dlgclose()'", "onclick='dlgclose()'"],
        ['<?php $datetimepicker_timepicker = true; ?>', '<?php $datetimepicker_timepicker = false; ?>'],
        ['<?php $datetimepicker_showseconds = false; ?>', '<?php $datetimepicker_showseconds = true; ?>'],
        ['<?php $datetimepicker_formatInput = false; ?>', '<?php $datetimepicker_formatInput = true; ?>'],
        ['document.forms[0].dates.style.backgroundColor = "red";', 'document.forms[0].dates.style.backgroundColor = "var(--oe-wb-paper)";'],
        ['document.forms[0].recipient_name.style.backgroundColor = "white";', 'document.forms[0].recipient_name.classList.remove("is-invalid");'],
        ['document.forms[0].desc_disc.style.backgroundColor = "red";', 'document.forms[0].desc_disc.classList.add("is-invalid");'],
        ["<input type='hidden' name='mode' value=\"disclosure\" />", ''],
        ['<input type="hidden" name="updatemode" value="disclosure_update">', ''],
        ["<input type='entry' size='20' class='datepicker form-control' name='dates' id='dates' value=''/>", "<input type='date' size='20' class='datepicker form-control' name='dates' id='dates' value=''/>"],
        ['<input type="entry" class="form-control" name="recipient_name" size="20" value="" />', '<input type="text" class="form-control" name="recipient_name" size="20" value="" />'],
        ['<textarea class="form-control" name="desc_disc" wrap="auto" rows="4" cols="30"></textarea>', '<textarea class="form-control" name="desc_disc" wrap="auto" rows="8" cols="30"></textarea>'],
        ["'list_id' => 'disclosure_type','fld_length' => '10','max_length' => '63','empty_title' => 'SKIP'], $app_event);", "'list_id' => 'disclosure_type','fld_length' => '10','max_length' => '63','empty_title' => ''], $app_event);"],
        ["<button class='btn btn-primary btn-save' name='form_save' id='form_save'>", "<button type='button' class='btn btn-primary btn-save' name='form_save' id='form_save'>"],
    ];
    const php = read(ROUTE);
    for (const [from, to] of mutations) {
        expect(count(php, from)).toBe(1);
        const restored = restore(php.replace(from, () => to));
        expect(restored === null ? null : sha(restored)).not.toBe(BASELINE);
    }
    // A stray class outside the declared list, or a dropped annotation, is caught too.
    expect(sha(restore(php.replace('name="recipient_name" size="20" value="" />', 'name="recipient_name" size="20" value="" data-x="1" />')))).not.toBe(BASELINE);
    expect(restore(php.replace('class="oe-disclosure-form" ', ''))).toBeNull();
});

// Exercises the inline submitform() only; no Cancel button is clicked here.
test('the original inline submitform() validation callback still runs unchanged in a real DOM', () => {
    const php = read(ROUTE);
    const source = php.slice(php.indexOf('function submitform() {'), php.indexOf('\n$(function () {'));
    const { window } = new JSDOM('<form><input name="dates"><input name="recipient_name"><textarea name="desc_disc"></textarea></form>', { runScripts: 'outside-only' });
    let restored = 0;
    let submitted = 0;
    window.top.restoreSession = () => { restored++; };
    window.document.forms[0].submit = () => { submitted++; };
    window.eval(source);
    const form = window.document.forms[0];
    // jsdom does not expose a form's controls as named properties; browsers do, and the route relies on it.
    for (const name of ['dates', 'recipient_name', 'desc_disc']) {
        Object.defineProperty(form, name, { get: () => form.elements.namedItem(name) });
    }
    window.submitform();
    expect(form.dates.style.backgroundColor).toBe('red');
    expect(window.document.activeElement).toBe(form.dates);
    form.dates.value = '2026-10-13 10:00';
    window.submitform();
    expect(form.dates.style.backgroundColor).toBe('white');
    expect(form.recipient_name.style.backgroundColor).toBe('red');
    form.recipient_name.value = 'Insurer';
    window.submitform();
    expect(form.recipient_name.style.backgroundColor).toBe('white');
    expect(form.desc_disc.style.backgroundColor).toBe('red');
    form.desc_disc.value = 'Summary';
    window.submitform();
    expect([restored, submitted]).toEqual([1, 1]);
});

test('the asset helper allowlists exactly the new basename', () => {
    const helper = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
    expect(helper).toMatch(/\n {8}'calendar-workday\.js',\n {8}'disclosure-popup\.css',\n {8}'encounter-document\.css',\n/);
    expect(count(helper, 'disclosure')).toBe(1);
});

// The Record/Edit links open this route through dlgopen (dialog frame); the route can also load in a
// normal patient frame. popup.js sets oe-workbench-context for both, oe-workbench-popup for dialogs only.
const SCOPE = 'html.oe-workbench-context body.oe-disclosure-editor';
const rules = () => {
    const out = [];
    postcss.parse(css()).walkRules(rule => {
        const decls = {};
        rule.walkDecls(d => { decls[d.prop] = `${d.value}${d.important ? ' !important' : ''}`; });
        const media = [];
        for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) media.push(p.params);
        out.push({ selectors: rule.selectors, decls, media });
    });
    return out;
};
const declsFor = selector => Object.assign({}, ...rules().filter(r => r.selectors.includes(selector)).map(r => r.decls));
const at = part => `${SCOPE} ${part}`;
const CONTROL = '.form-control:not(.is-invalid, .is-valid, .was-validated *)';

test('the sheet is one screen block, positive-scoped to the context marker and the route body', () => {
    const tree = postcss.parse(css());
    const top = tree.nodes.filter(node => node.type !== 'comment');
    expect(top).toHaveLength(1);
    expect(top[0].type === 'atrule' && top[0].name === 'media' && top[0].params).toBe('screen');
    const media = [];
    tree.walkAtRules(at => media.push(`${at.name} ${at.params}`));
    expect(media).toEqual(['media screen']);
    const all = rules();
    expect(all.length).toBeGreaterThan(12);
    for (const { selectors } of all) {
        for (const selector of selectors) {
            expect(selector === SCOPE || selector.startsWith(`${SCOPE} `)).toBe(true);
            expect(selector).not.toMatch(/oe-clinical-workspace|workbench-active|oe-workbench-popup|:not\(html|print/);
            // Calendar overlays (appended to body) are not restyled in this slice.
            expect(selector).not.toMatch(/xdsoft|datetimepicker|select2|\.modal/);
        }
    }
});

// Original font family and size are retained; title and label weight is explicitly set to 600.
test('typography: no font family or size replacement (title/label weight is 600)', () => {
    for (const { decls } of rules()) {
        expect(decls['font-family']).toBeUndefined();
        expect(decls.font).toBeUndefined();
        expect(decls['font-size']).toBeUndefined();
        expect(decls['letter-spacing']).toBeUndefined();
        expect(decls['text-transform']).toBeUndefined();
    }
});

// Declares no hidden/clip overflow; the sheet's overflow-x:auto is still a scroll container.
test('presentation declares no hiding, overflow hidden/clip, disabling or reordering of route content', () => {
    for (const { decls } of rules()) {
        expect(decls.display ?? '').not.toMatch(/none|contents|!important/);
        expect(decls.visibility).toBeUndefined();
        expect(decls.order).toBeUndefined();
        expect(decls['flex-direction'] ?? '').not.toMatch(/reverse/);
        expect(decls.position ?? '').not.toMatch(/fixed|absolute|sticky/);
        expect(decls['text-overflow']).toBeUndefined();
        expect(decls['white-space'] ?? '').not.toMatch(/nowrap/);
        expect(decls.overflow ?? '').not.toMatch(/hidden|clip/);
        expect(decls['overflow-x'] ?? '').not.toMatch(/hidden|clip/);
        expect(decls.height).toBeUndefined();
        expect(decls['max-height']).toBeUndefined();
        for (const value of Object.values(decls)) expect(value).not.toMatch(/!important/);
    }
    expect(css()).not.toMatch(/pointer-events|user-select|opacity:\s*0[;\s]|content:|!important/);
});

test('RTL: spacing and alignment are logical, never physical', () => {
    for (const { decls } of rules()) {
        for (const prop of Object.keys(decls)) {
            expect(prop).not.toMatch(/(^|-)(left|right|top|bottom)($|-)/);
            expect(prop).not.toMatch(/^float$/);
        }
        expect(decls['text-align'] ?? 'start').toMatch(/^(start|end|center)$/);
    }
});

test('document shape: sheet, ruled header, field rhythm, wrapping actions, document-sized description', () => {
    expect(declsFor(SCOPE)).toMatchObject({ color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-canvas)', margin: '0' });
    expect(declsFor(at('.oe-disclosure-sheet'))).toMatchObject({
        color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)', border: '1px solid var(--oe-wb-line)', 'border-radius': expect.any(String),
    });
    expect(declsFor(at('.oe-disclosure-header'))).toMatchObject({ 'border-block-end': '1px solid var(--oe-wb-line)' });
    expect(declsFor(at('.oe-disclosure-title'))).toMatchObject({ display: 'block', color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)', 'font-weight': '600', margin: '0' });
    expect(declsFor(at('.oe-disclosure-field'))).toMatchObject({ 'margin-block': expect.any(String) });
    expect(declsFor(at('.oe-disclosure-field label'))).toMatchObject({ display: 'block', color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)', 'font-weight': '600' });
    expect(declsFor(at('.btn-group.oe-disclosure-actions'))).toMatchObject({ display: 'flex', 'flex-wrap': 'wrap', gap: expect.any(String) });
    // Description is a document field: full width, comfortable minimum, only vertical resizing.
    expect(declsFor(at('.oe-disclosure-field textarea.form-control'))).toMatchObject({ width: '100%', 'min-height': expect.stringMatching(/rem$/), resize: 'vertical' });
    // Short single-line fields cap their width but always shrink to the frame.
    for (const part of ['input.form-control', 'select.form-control']) {
        expect(declsFor(at(`.oe-disclosure-field ${part}`))).toMatchObject({ width: '100%', 'max-width': expect.stringMatching(/rem$/) });
    }
});

// Token values come from popup.css, which defines them under html.oe-workbench-context for
// normal frames and dialogs alike; the pairs below are therefore fixed light values in dark themes too.
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

test('light and dark themes: every text-bearing node pairs explicit neutral ink with a surface, readably', () => {
    const paired = [
        SCOPE,
        at('.oe-disclosure-sheet'),
        at('.oe-disclosure-title'),
        at('.oe-disclosure-field label'),
        at(`.oe-disclosure-field ${CONTROL}`),
        at(`.oe-disclosure-field ${CONTROL}:focus`),
        at('.oe-disclosure-actions .btn-secondary'),
        at('.oe-disclosure-actions .btn-primary'),
    ];
    for (const selector of paired) {
        const { color, background } = declsFor(selector);
        expect([selector, color]).toEqual([selector, expect.stringMatching(/^var\(--oe-wb-[a-z-]+\)$/)]);
        expect([selector, background]).toEqual([selector, expect.stringMatching(/^var\(--oe-wb-[a-z-]+\)$/)]);
        expect(tokenValue(color)).toMatch(/^#[0-9a-f]{3,6}$/i);
        expect(tokenValue(background)).toMatch(/^#[0-9a-f]{3,6}$/i);
        expect(contrast(tokenValue(color), tokenValue(background))).toBeGreaterThanOrEqual(4.5);
    }
    // Every colour or background anywhere in the sheet is paired in the same rule.
    for (const { selectors, decls } of rules()) {
        const hasInk = 'color' in decls;
        const hasSurface = 'background' in decls || 'background-color' in decls;
        expect([selectors[0], hasInk]).toEqual([selectors[0], hasSurface]);
    }
    expect(css()).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
});

test('validation semantics: inline colours and Bootstrap states win over neutral control paint', () => {
    const paint = /^(color|background|background-color|background-image|border|border-color|outline|box-shadow)$/;
    for (const { selectors, decls } of rules()) {
        if (!Object.keys(decls).some(prop => paint.test(prop))) continue;
        for (const selector of selectors.filter(s => /\.form-control|input|select|textarea/.test(s))) {
            expect(selector).toContain(CONTROL);
        }
    }
    // No attribute or inline-style targeting, no semantic classes asserted by the sheet itself.
    expect(css()).not.toMatch(/\[style|is-invalid\b(?!, \.is-valid, \.was-validated \*\))|text-danger|bg-danger|alert/);
    // Disabled and read-only controls keep a disabled pair.
    for (const state of [':disabled', '[readonly]']) {
        expect(declsFor(at(`.oe-disclosure-field ${CONTROL}${state}`))).toMatchObject({ color: 'var(--oe-wb-disabled-ink)', background: 'var(--oe-wb-disabled-paper)' });
    }
});

test('focus stays visible on fields and actions, with the focused field pair restated', () => {
    expect(declsFor(at(`.oe-disclosure-field ${CONTROL}:focus`))).toMatchObject({
        color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)', outline: '2px solid var(--oe-wb-petrol)', 'outline-offset': expect.any(String),
    });
    expect(declsFor(at('.oe-disclosure-actions .btn:focus-visible'))).toMatchObject({ outline: '2px solid var(--oe-wb-petrol)', 'outline-offset': expect.any(String) });
    expect(css()).not.toMatch(/outline:\s*(0|none)/);
});

test('jsdom: rules only match under the context marker plus the route body', () => {
    const markup = '<div class="container oe-disclosure-sheet"><span class="title oe-disclosure-title">t</span></div>';
    const titleRules = rules().flatMap(r => r.selectors).filter(s => s.endsWith('.oe-disclosure-title'));
    const { document } = new JSDOM('').window;
    const matches = (htmlClass, bodyClass) => {
        document.documentElement.className = htmlClass;
        document.body.className = bodyClass;
        document.body.innerHTML = markup;
        const title = document.querySelector('.oe-disclosure-title');
        return titleRules.some(s => title.matches(s));
    };
    expect(matches('oe-workbench-context', 'oe-disclosure-editor')).toBe(true); // normal frame
    expect(matches('oe-workbench-context oe-workbench-popup', 'oe-disclosure-editor')).toBe(true); // dialog
    expect(matches('oe-workbench-popup', 'oe-disclosure-editor')).toBe(false);
    expect(matches('', 'oe-disclosure-editor')).toBe(false); // standalone / explicit legacy
    expect(matches('oe-workbench-context', 'oe-issue-editor')).toBe(false); // other routes
});

// Real popup.js controllers in real JSDOM windows wired as the browser exposes them
// (see workbench-popup.test.js): the route sheet must engage exactly when popup.js says so.
// The shell is synthetic: tests toggle its workbench-active class by hand; the production
// mode.js controller is not exercised.
describe('route sheet follows the real popup.js context in every entry path', () => {
    const ORIGIN = 'https://emr.test';
    const makeWindow = (markup, { url = `${ORIGIN}/interface/patient_file/summary/record_disclosure.php`, parent, opener, frameElement } = {}) => {
        const { window } = new JSDOM(markup, { url, runScripts: 'outside-only' });
        if (parent) Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });
        if (frameElement) Object.defineProperty(window, 'frameElement', { configurable: true, get: () => frameElement });
        if (opener) window.opener = opener;
        return window;
    };
    const makeShell = () => makeWindow(
        '<body class="workbench-active"><div id="mainBox"><button type="button" data-workbench-mode></button></div>'
        + '<div class="modal fade dialogModal"><div class="modal-dialog"><div class="modal-content">'
        + '<iframe class="modalIframe"></iframe></div></div></div><iframe name="pat"></iframe></body>',
        { url: `${ORIGIN}/interface/main/tabs/main.php` },
    );
    const route = '<body class="oe-disclosure-editor"><div class="container oe-disclosure-sheet" id="record-disclosure"><div class="row">'
        + '<div class="col-12 oe-disclosure-header"><span class="title oe-disclosure-title">t</span></div></div></div></body>';
    const controller = win => {
        jest.resetModules();
        return require('../../interface/clinical-workspace/popup.js').createPopupController({ win });
    };
    const titleSelectors = () => rules().flatMap(r => r.selectors).filter(s => s.endsWith(' .oe-disclosure-title'));
    const engaged = win => {
        const title = win.document.querySelector('.oe-disclosure-title');
        return titleSelectors().some(selector => title.matches(selector));
    };
    const flush = () => new Promise(resolve => setTimeout(resolve, 0));

    test('the Record/Edit dlgopen dialog frame engages the sheet', () => {
        const shell = makeShell();
        // disclosure_full.php runs in the patient frame and dlgopen attaches the modal to the shell.
        const dialog = makeWindow(route, { parent: shell, frameElement: shell.document.querySelector('iframe.modalIframe') });
        expect(controller(dialog).active).toBe(true);
        expect([...dialog.document.documentElement.classList].sort()).toEqual(['oe-workbench-context', 'oe-workbench-popup']);
        expect(engaged(dialog)).toBe(true);
    });

    test('a normal patient content frame engages the sheet too', () => {
        const shell = makeShell();
        const tab = makeWindow(route, { parent: shell, frameElement: shell.document.querySelector('iframe[name="pat"]') });
        expect(controller(tab).active).toBe(true);
        expect([...tab.document.documentElement.classList]).toEqual(['oe-workbench-context']);
        expect(engaged(tab)).toBe(true);
    });

    test.each([['dialog', 'iframe.modalIframe'], ['normal frame', 'iframe[name="pat"]']])('popup.js follows manual workbench-active class toggles on the synthetic shell (%s)', async (_, frame) => {
        const shell = makeShell();
        const win = makeWindow(route, { parent: shell, frameElement: shell.document.querySelector(frame) });
        controller(win);
        expect(engaged(win)).toBe(true);
        shell.document.body.classList.remove('workbench-active');
        await flush();
        expect([...win.document.documentElement.classList]).toEqual([]);
        expect(engaged(win)).toBe(false);
        shell.document.body.classList.add('workbench-active');
        await flush();
        expect(engaged(win)).toBe(true);
    });

    test('an inactive shell, a standalone window and a non-workbench opener stay legacy', () => {
        const inactive = makeShell();
        inactive.document.body.classList.remove('workbench-active');
        const dialog = makeWindow(route, { parent: inactive, frameElement: inactive.document.querySelector('iframe.modalIframe') });
        expect(controller(dialog).active).toBe(false);
        expect(engaged(dialog)).toBe(false);

        const standalone = makeWindow(route);
        controller(standalone);
        expect(engaged(standalone)).toBe(false);

        const opened = makeWindow(route, { opener: makeWindow('<body class="body_top"></body>') });
        controller(opened);
        expect(engaged(opened)).toBe(false);
    });
});

// Narrow dialogs: the shared popup layer leaves the body's UA margin and Bootstrap's container/row/col
// gutters in place, which together eat ~76px of a 146px frame. This is a declared-box estimate of the
// sheet (16px rem assumed, approximate text widths, Font Awesome button prefixes omitted), not a
// browser layout measurement or proof of native wrapping; native acceptance at these widths is outstanding.
describe.each([146, 180])('narrow frame (%ipx): declared-box estimate of gutters and action sizing', width => {
    const px = value => {
        const m = String(value).match(/^(\d*\.?\d+)(px|rem)$/);
        if (value === '0') return 0;
        expect(m).not.toBeNull();
        return Number(m[1]) * (m[2] === 'rem' ? 16 : 1);
    };

    // overflow-x:auto makes the sheet a scroll container (the other axis computes to auto too);
    // that it never clips is not established here.
    test('row and column gutters are zeroed and the sheet declares overflow-x:auto', () => {
        expect(declsFor(at('.oe-disclosure-sheet > .row'))).toMatchObject({ 'margin-inline': '0' });
        expect(declsFor(at(".oe-disclosure-sheet > .row > [class*='col']"))).toMatchObject({ 'padding-inline': '0' });
        expect(declsFor(at('.oe-disclosure-sheet'))).toMatchObject({ 'overflow-x': 'auto', 'max-width': expect.any(String) });
        expect(css()).not.toMatch(/\b15px\b|\b30px\b/);
    });

    test('the estimated inner width leaves room for the original action label widths (no icon prefixes counted)', () => {
        const body = declsFor(SCOPE);
        const sheet = declsFor(at('.oe-disclosure-sheet'));
        const inner = width - 2 * px(body.margin) - 2 * px(body.padding ?? '0') - 2 * px(sheet['padding-inline']) - 2 * px(sheet.border.split(' ')[0]);
        // "Cancel" at Bootstrap's 1rem/0.75rem-padded .btn is roughly 70px by estimate, excluding
        // Font Awesome prefixes; leave headroom for translations.
        expect(inner).toBeGreaterThanOrEqual(110);
        const group = declsFor(at('.btn-group.oe-disclosure-actions'));
        expect(group['flex-wrap']).toBe('wrap');
        const btn = declsFor(at('.oe-disclosure-actions .btn'));
        // Bootstrap's .btn-group > .btn is flex: 1 1 auto with collapsed corners and -1px overlap;
        // wrapped buttons keep their own size, corners and spacing, and long labels may wrap.
        expect(btn).toMatchObject({ flex: '0 1 auto', 'margin-inline': '0', 'white-space': 'normal', 'border-radius': expect.any(String), 'max-width': '100%' });
        expect(btn['font-size']).toBeUndefined();
        expect(btn.display).toBeUndefined();
        // Estimate only: at 180px the two label widths plus gap fit the inner width (icon prefixes
        // omitted, so one-line layout is not proven); at 146px they may wrap.
        const gap = px(group.gap);
        expect(gap).toBeGreaterThan(0);
        if (width === 180) expect(inner).toBeGreaterThanOrEqual(60 + 70 + gap);
    });
});

test('stylelint: the new sheet lints clean under the repo config without any new override', () => {
    const rc = JSON.parse(read('.stylelintrc.json'));
    expect(JSON.stringify(rc.overrides)).not.toContain('disclosure');
    const bin = path.join(path.dirname(require.resolve('stylelint/package.json')), 'bin/stylelint.mjs');
    const configStandardDir = path.dirname(require.resolve('stylelint-config-standard'));
    const configBasedir = path.resolve(configStandardDir, '../..');
    const run = spawnSync(process.execPath, [bin, '--config', path.join(root, '.stylelintrc.json'), '--config-basedir', configBasedir, '--formatter', 'json', path.join(root, SHEET)], { encoding: 'utf8' });
    expect(run.error).toBeUndefined();
    const report = JSON.parse(run.stderr || run.stdout);
    expect(report.flatMap(r => [...r.parseErrors, ...r.invalidOptionWarnings, ...r.warnings.map(w => `${w.rule}: ${w.text}`)])).toEqual([]);
    expect(run.status).toBe(0);
});
