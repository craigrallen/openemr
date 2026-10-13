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
const ROUTE = 'interface/patient_file/void_dialog.php';
const FEE_SHEET = 'interface/forms/fee_sheet/new.php';
const CHECKOUT = 'interface/patient_file/pos_checkout_ippf.php';
const SHEET = 'interface/clinical-workspace/void-dialog.css';
const css = () => read(SHEET);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const count = (text, part) => text.split(part).length - 1;

// sha256 of void_dialog.php at master 18647270, before the workbench presentation edits.
const BASELINE = '4c08b4238fc4d084d02c3b8fab8f5a9e13cca255d834b2fd49c5737a8f93339c';

const link = '<?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n'
    + '<link rel="stylesheet" media="screen" href="<?php echo attr(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/void-dialog.css?v=<?php echo attr_url($clinicalAssets->version(\'void-dialog.css\')); ?>">\n';

// The complete presentation edit map, each entry [original, presented]: one use line, one
// versioned screen link, and route/document/fields/actions classes on existing elements.
const changes = [
    ['\nuse OpenEMR\\Core\\Header;\n', '\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Core\\Header;\n'],
    ["<?php Header::setupHeader(['common', 'datetime-picker', 'opener']); ?>\n",
        `<?php Header::setupHeader(['common', 'datetime-picker', 'opener']); ?>\n${link}`],
    ['<body>\n\n<div class="container-fluid">\n', '<body class="oe-void-dialog">\n\n<div class="container-fluid oe-void-document">\n'],
    ["<table border='0'>\n", "<table border='0' class='oe-void-fields'>\n"],
    ['echo "<p>\\n";', 'echo "<p class=\'oe-void-actions\'>\\n";'],
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

describe('void_dialog.php carries only the declared presentation edits', () => {
    test('reversing the full edit map restores the exact original route digest', () => {
        const php = read(ROUTE);
        for (const [, after] of changes) expect(count(php, after)).toBe(1);
        const restored = restore(php);
        expect(restored).not.toBeNull();
        expect(sha(restored)).toBe(BASELINE);
    });

    test('the route sheet is linked once, screen only, versioned through the helper, after the original Header', () => {
        const php = read(ROUTE);
        expect(count(php, 'void-dialog.css')).toBe(2);
        expect(count(php, link)).toBe(1);
        expect(php).not.toMatch(/void-dialog\.css\?v=(?!<\?php echo attr_url\(\$clinicalAssets)/);
        // No generic workspace sheet, no new mode script, no second popup asset: Header already loads popup.js.
        expect(php).not.toMatch(/clinical-workspace\/(workspace|popup|mode)\.(css|js)/);
        expect(php).not.toMatch(/setupAssets|mode\.js/);
        expect(php.indexOf('void-dialog.css')).toBeGreaterThan(php.indexOf('Header::setupHeader('));
        expect(php.indexOf('void-dialog.css')).toBeLessThan(php.indexOf('<title>'));
        expect(php).not.toMatch(/media="print"|@media print/);
    });

    test('original includes, Header options, reason descriptor, controls, form and script are present verbatim', () => {
        const php = read(ROUTE);
        for (const fragment of [
            "require_once('../globals.php');\n",
            'require_once(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getSrcDir() . "/options.inc.php");\n',
            "<?php Header::setupHeader(['common', 'datetime-picker', 'opener']); ?>\n",
            "generate_form_field(\n    [\n        'data_type' => 1,\n        'field_id' => 'reason',\n        'list_id' => 'void_reasons',\n        'empty_title' => 'Select Reason'\n    ],\n    ''\n);",
            "<input type='text' size='40' name='form_notes' maxlength='80' value='' style='width:100%' />",
            "<form method='post'>\n",
            "echo \"<input type='button' value='\" . xla('Submit') . \"' onclick='DoSubmit()' />&nbsp;\\n\";",
            "echo \"<input type='button' value='\" . xla('Cancel') . \"' onclick='window.close()' />\\n\";",
            "<td valign='top' nowrap><b><?php echo xlt('Void Reason'); ?>:</b></td>",
            "<td valign='top' nowrap><b><?php echo xlt('Void Notes'); ?>:</b></td>",
        ]) {
            expect([fragment, count(php, fragment)]).toEqual([fragment, 1]);
        }
    });

    test('the real fee sheet and checkout callers are byte-identical and still open the route through dlgopen', () => {
        const fee = read(FEE_SHEET);
        const checkout = read(CHECKOUT);
        expect(sha(fee)).toBe('f419fe70b745742a863f64627c433fd1dbead7e912c34162dc9be042a7183260');
        expect(sha(checkout)).toBe('640bb12d99de8ecbc9677f7a2ae96abdeb19fd224fe8db302a163b3add5cc0cf');
        expect(count(fee, "dlgopen('../../patient_file/void_dialog.php', '_blank', 500, 450);")).toBe(1);
        expect(count(checkout, "dlgopen('void_dialog.php', '_blank', 500, 450);")).toBe(1);
        expect(count(fee, 'function voidwrap(form_reason, form_notes) {')).toBe(1);
        expect(count(checkout, 'function voidwrap(form_reason, form_notes) {')).toBe(1);
    });
});

test('negative controls: script, alerts, schema, controls, form or includes cannot change unnoticed', () => {
    const mutations = [
        ["require_once('../globals.php');", "require_once('../../globals.php');"],
        ['"/options.inc.php");', '"/options.inc.php"); require_once("x.php");'],
        ["Header::setupHeader(['common', 'datetime-picker', 'opener'])", "Header::setupHeader(['common', 'opener'])"],
        ["'data_type' => 1,", "'data_type' => 26,"],
        ["'list_id' => 'void_reasons',", "'list_id' => 'void_reason',"],
        ["'empty_title' => 'Select Reason'", "'empty_title' => 'SKIP'"],
        ["    ],\n    ''\n);", "    ],\n    'other'\n);"],
        ["name='form_notes'", "name='notes'"],
        ["size='40' name='form_notes'", "size='30' name='form_notes'"],
        ["maxlength='80'", "maxlength='255'"],
        ["style='width:100%'", "style='width:90%'"],
        ["<input type='text' size='40'", "<input type='search' size='40'"],
        ["<form method='post'>", "<form method='get'>"],
        ['if (opener.closed || !opener.voidwrap) {', 'if (!opener.voidwrap) {'],
        ['else if (f.form_reason.selectedIndex == 0) {', 'else if (f.form_reason.value == "") {'],
        ["else if (f.form_notes.value.trim() == '') {", "else if (f.form_notes.value == '') {"],
        ['opener.voidwrap(f.form_reason.value, f.form_notes.value);', 'opener.voidwrap(f.form_reason.value, f.form_notes.value.trim());'],
        ["alert(<?php echo xlj('Please specify Void Notes.'); ?>);", "alert(<?php echo xlj('Notes?'); ?>);"],
        ["alert(<?php echo xlj('The destination form was closed; I cannot act on your selection.'); ?>);", ''],
        ['  window.close();\n  return false;\n};', '  return false;\n};'],
        ["onclick='DoSubmit()'", "onclick='return DoSubmit()'"],
        ["onclick='window.close()'", "onclick='dlgclose()'"],
        ["<input type='button' value='\" . xla('Submit')", "<input type='submit' value='\" . xla('Submit')"],
    ];
    const php = read(ROUTE);
    for (const [from, to] of mutations) {
        expect([from, count(php, from)]).toEqual([from, 1]);
        const restored = restore(php.replace(from, () => to));
        expect([from, restored === null ? null : sha(restored)]).not.toEqual([from, BASELINE]);
    }
    // A stray attribute or a dropped annotation is caught too.
    expect(sha(restore(php.replace("maxlength='80' value=''", "maxlength='80' class='form-control' value=''")))).not.toBe(BASELINE);
    expect(restore(php.replace(" class='oe-void-fields'", ''))).toBeNull();
    expect(restore(php.replace('<body class="oe-void-dialog">', '<body>'))).toBeNull();
});

test('the asset helper allowlists exactly the new basename, in order', () => {
    const helper = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
    expect(helper).toMatch(/\n {8}'visit-history\.js',\n {8}'void-dialog\.css',\n {8}'workspace\.css',\n/);
    expect(count(helper, 'void')).toBe(1);
});

// --- The original callback, executed in a real DOM ---------------------------------------------

// xlj() with translation disabled is json_encode(); the route's three alerts are the only xlj calls.
const XLJ = /<\?php echo xlj\('([^']*)'\); \?>/g;
const callbackSource = () => {
    const php = read(ROUTE);
    const start = php.indexOf('<script>\n') + '<script>\n'.length;
    const script = php.slice(start, php.indexOf('</script>', start));
    expect(count(script, '<?php')).toBe(3);
    const js = script.replace(XLJ, (_, text) => JSON.stringify(text));
    expect(js).not.toContain('<?php');
    return js;
};
// Controls exactly as the route echoes them (xla() with translation disabled is attr()).
const actionMarkup = () => {
    const php = read(ROUTE);
    return [...php.matchAll(/echo "(<input type='button' value='" \. xla\('(Submit|Cancel)'\) \. "' onclick='[^']+' \/>)(&nbsp;)?\\n";/g)]
        .map(([, input, label, nbsp]) => input.replace(/" \. xla\('(Submit|Cancel)'\) \. "/, label) + (nbsp ?? '') + '\n')
        .join('');
};
const notesMarkup = () => read(ROUTE).match(/<input type='text' size='40' name='form_notes'[^>]*\/>/)[0];

const dialog = ({ opener }) => {
    const markup = "<form method='post'><table border='0'><tr><td>"
        + "<select name='form_reason' id='form_reason' class='form-control'><option value=''>Select Reason</option>"
        + "<option value='SYN_DUP'>Synthetic duplicate</option></select></td></tr><tr><td>" + notesMarkup()
        + '</td></tr></table><p>' + actionMarkup() + '</p></form>';
    const { window } = new JSDOM(markup, { runScripts: 'dangerously' });
    const calls = { alerts: [], closed: 0, voided: [], submits: 0 };
    window.alert = message => { calls.alerts.push(message); };
    window.close = () => { calls.closed++; };
    window.opener = opener ? opener(calls) : null;
    window.document.forms[0].addEventListener('submit', event => { calls.submits++; event.preventDefault(); });
    window.eval(callbackSource());
    const form = window.document.forms[0];
    // jsdom does not expose controls as named form properties; browsers do and DoSubmit relies on it.
    for (const name of ['form_reason', 'form_notes']) {
        Object.defineProperty(form, name, { get: () => form.elements.namedItem(name) });
    }
    const click = label => window.document.querySelector(`input[type='button'][value='${label}']`).click();
    return { window, form, calls, click };
};
const liveOpener = calls => ({ closed: false, voidwrap: (reason, notes) => { calls.voided.push([reason, notes]); } });

describe('original DoSubmit() and Cancel callbacks run unchanged', () => {
    test('the rendered actions are the two original button inputs, Submit then Cancel, no submit control', () => {
        expect(actionMarkup()).toBe("<input type='button' value='Submit' onclick='DoSubmit()' />&nbsp;\n<input type='button' value='Cancel' onclick='window.close()' />\n");
        const { window } = dialog({ opener: liveOpener });
        expect(window.document.querySelectorAll("[type='submit'], button").length).toBe(0);
    });

    test('valid reason and notes hand the raw, untrimmed notes to opener.voidwrap and close', () => {
        const { form, calls, click } = dialog({ opener: liveOpener });
        form.form_reason.selectedIndex = 1;
        form.form_notes.value = '  Synthetic note  ';
        click('Submit');
        expect(calls).toEqual({ alerts: [], closed: 1, voided: [['SYN_DUP', '  Synthetic note  ']], submits: 0 });
    });

    test('DoSubmit returns false on every path', () => {
        const { window, form } = dialog({ opener: liveOpener });
        expect(window.DoSubmit()).toBe(false);
        form.form_reason.selectedIndex = 1;
        form.form_notes.value = 'x';
        expect(window.DoSubmit()).toBe(false);
    });

    test('no reason selected: native alert, dialog stays open, opener untouched', () => {
        const { form, calls, click } = dialog({ opener: liveOpener });
        form.form_notes.value = 'Synthetic note';
        click('Submit');
        expect(calls).toEqual({ alerts: ['Please specify Void Reason.'], closed: 0, voided: [], submits: 0 });
    });

    test('whitespace-only notes: native alert, dialog stays open, opener untouched', () => {
        const { form, calls, click } = dialog({ opener: liveOpener });
        form.form_reason.selectedIndex = 1;
        form.form_notes.value = ' \t ';
        click('Submit');
        expect(calls).toEqual({ alerts: ['Please specify Void Notes.'], closed: 0, voided: [], submits: 0 });
    });

    test.each([
        ['a closed destination', () => ({ closed: true, voidwrap() { throw new Error('must not be called'); } })],
        ['a destination without voidwrap', () => ({ closed: false })],
    ])('%s: native alert, then the dialog closes without acting', (_, opener) => {
        const { form, calls, click } = dialog({ opener });
        // The destination check runs before validation, even with nothing entered.
        click('Submit');
        expect(calls).toEqual({ alerts: ['The destination form was closed; I cannot act on your selection.'], closed: 1, voided: [], submits: 0 });
        form.form_reason.selectedIndex = 1;
        form.form_notes.value = 'x';
        click('Submit');
        expect(calls.closed).toBe(2);
    });

    test('Cancel closes through its inline handler without validating or calling the opener', () => {
        const { calls, click } = dialog({ opener: liveOpener });
        click('Cancel');
        expect(calls).toEqual({ alerts: [], closed: 1, voided: [], submits: 0 });
    });

    // Inherited, not accepted: the form has one text field and no submit button, so Enter in
    // Void Notes implicitly submits a POST to the route itself, bypassing DoSubmit(). This slice
    // preserves that behaviour byte-for-byte and only pins the structure that produces it.
    test('Enter/default-submit structure is inherited unchanged', () => {
        const php = read(ROUTE);
        expect(count(php, "<form method='post'>")).toBe(1);
        expect(php).not.toMatch(/onsubmit|type='submit'|type="submit"|<button/i);
        expect(php.match(/<input type='text'/g)).toHaveLength(1);
    });
});

// --- Route stylesheet ----------------------------------------------------------------------------

// dlgopen loads this route in a dialog frame; popup.js sets oe-workbench-context there (and in any
// other frame of an active workbench), so every rule pairs that marker with the route body class.
const SCOPE = 'html.oe-workbench-context body.oe-void-dialog';
const at = part => `${SCOPE} ${part}`;
const GUARD = ':not(.is-invalid, .is-valid, .was-validated *)';
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

test('the sheet is one @media screen block, positive-scoped to the context marker and the route body', () => {
    const tree = postcss.parse(css());
    const top = tree.nodes.filter(node => node.type !== 'comment');
    expect(top).toHaveLength(1);
    expect(top[0].type === 'atrule' && top[0].name === 'media' && top[0].params).toBe('screen');
    const media = [];
    tree.walkAtRules(rule => media.push(`${rule.name} ${rule.params}`));
    // No breakpoints: narrow frames are handled by wrapping, not media queries.
    expect(media).toEqual(['media screen']);
    const all = rules();
    expect(all.length).toBeGreaterThan(8);
    for (const { selectors } of all) {
        for (const selector of selectors) {
            expect(selector === SCOPE || selector.startsWith(`${SCOPE} `)).toBe(true);
            expect(selector).not.toMatch(/oe-clinical-workspace|workbench-active|oe-workbench-popup|print|xdsoft|select2|\.modal/);
        }
    }
});

test('typography is inherited: no font family, size, spacing or case replacement', () => {
    for (const { decls } of rules()) {
        for (const prop of ['font', 'font-family', 'font-size', 'line-height', 'letter-spacing', 'text-transform', 'zoom', 'transform']) {
            expect(decls[prop]).toBeUndefined();
        }
    }
});

test('nothing is hidden, clipped, shrunk, disabled or reordered', () => {
    for (const { decls } of rules()) {
        expect(decls.display ?? '').not.toMatch(/none|contents|flex|grid/);
        expect(decls.visibility).toBeUndefined();
        expect(decls.order).toBeUndefined();
        expect(decls.position ?? '').not.toMatch(/fixed|absolute|sticky/);
        expect(decls['text-overflow']).toBeUndefined();
        expect(decls['white-space'] ?? 'normal').toBe('normal');
        expect(decls.overflow ?? '').not.toMatch(/hidden|clip/);
        expect(decls['overflow-x'] ?? '').not.toMatch(/hidden|clip/);
        expect(decls.height).toBeUndefined();
        expect(decls['max-height']).toBeUndefined();
        expect(decls['min-width']).toBeUndefined();
        expect(decls.width ?? '100%').toBe('100%');
        expect(decls.flex).toBeUndefined();
    }
    expect(css()).not.toMatch(/pointer-events|user-select|opacity|content:|!important|clip-path/);
});

test('RTL: spacing and alignment are logical, never physical', () => {
    for (const { decls } of rules()) {
        for (const prop of Object.keys(decls)) {
            expect(prop).not.toMatch(/(^|-)(left|right|top|bottom)($|-)/);
            expect(prop).not.toBe('float');
        }
        expect(decls['text-align'] ?? 'start').toMatch(/^(start|end)$/);
    }
});

test('document shape: canvas body, paper sheet, start-aligned content, stacked fields, wrapping actions', () => {
    expect(declsFor(SCOPE)).toMatchObject({ margin: '0', color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-canvas)' });
    expect(declsFor(at('.oe-void-document'))).toMatchObject({
        color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)', border: '1px solid var(--oe-wb-line)',
        'border-radius': expect.any(String), 'padding-inline': expect.stringMatching(/rem$/), 'overflow-x': 'auto',
    });
    // The legacy <center> wrapper stays in the DOM; its UA centring gives way to start alignment.
    expect(declsFor(at('.oe-void-document center'))).toMatchObject({ 'text-align': 'start' });
    // The two-column field table is stacked on its existing nodes: label above control.
    for (const part of ['.oe-void-fields', '.oe-void-fields tbody', '.oe-void-fields tr', '.oe-void-fields td']) {
        expect(declsFor(at(part))).toMatchObject({ display: 'block' });
    }
    expect(declsFor(at('.oe-void-fields'))).toMatchObject({ width: '100%' });
    // nowrap on the label cells is a presentational hint; labels may wrap in narrow frames.
    expect(declsFor(at('.oe-void-fields td'))).toMatchObject({ padding: '0', 'white-space': 'normal' });
    expect(declsFor(at('.oe-void-fields td:first-child'))).toMatchObject({ color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)', 'margin-block-end': expect.any(String) });
    expect(declsFor(at('.oe-void-fields td:last-child'))).toMatchObject({ 'margin-block-end': expect.any(String) });
    expect(declsFor(at('.oe-void-actions'))).toMatchObject({ 'text-align': 'start', 'margin-block': expect.any(String) });
});

// Token values from popup.css, defined under html.oe-workbench-context for frames and dialogs
// alike; they are fixed light values, so every pair below holds in dark themes too.
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
const SELECT = `.oe-void-fields select${GUARD}`;
const NOTES = `.oe-void-fields input[type='text']${GUARD}`;
const BUTTON = ".oe-void-actions input[type='button']";

test('light and dark themes: every text-bearing node pairs neutral ink with a surface, readably', () => {
    const paired = [
        SCOPE,
        at('.oe-void-document'),
        at('.oe-void-fields td:first-child'),
        at(SELECT), at(`${SELECT}:focus`),
        at(NOTES), at(`${NOTES}:focus`),
        at(BUTTON), at(`${BUTTON}:first-child`),
    ];
    for (const selector of paired) {
        const { color, background } = declsFor(selector);
        expect([selector, color]).toEqual([selector, expect.stringMatching(/^var\(--oe-wb-[a-z-]+\)$/)]);
        expect([selector, background]).toEqual([selector, expect.stringMatching(/^var\(--oe-wb-[a-z-]+\)$/)]);
        expect(contrast(tokenValue(color), tokenValue(background))).toBeGreaterThanOrEqual(4.5);
    }
    for (const { selectors, decls } of rules()) {
        const hasInk = 'color' in decls;
        const hasSurface = 'background' in decls || 'background-color' in decls;
        expect([selectors[0], hasInk]).toEqual([selectors[0], hasSurface]);
    }
    // Only the ink/canvas/paper/petrol/line palette; no literal colours.
    // Values only: property names such as white-space are not colours.
    for (const { decls } of rules()) {
        for (const value of Object.values(decls)) expect(value).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(|\b(white|black|red)\b/i);
    }
    for (const used of css().match(/--oe-wb-[a-z-]+/g)) {
        expect(['--oe-wb-ink', '--oe-wb-canvas', '--oe-wb-paper', '--oe-wb-petrol', '--oe-wb-on-petrol', '--oe-wb-line']).toContain(used);
    }
});

test('validation semantics: field paint skips Bootstrap validation states and never targets inline style', () => {
    const paint = /^(color|background|background-color|border|border-color|outline|box-shadow)$/;
    for (const { selectors, decls } of rules()) {
        if (!Object.keys(decls).some(prop => paint.test(prop))) continue;
        for (const selector of selectors.filter(s => /select|input\[type='text'\]/.test(s))) {
            expect(selector).toContain(GUARD);
        }
    }
    expect(css()).not.toMatch(/\[style|text-danger|bg-danger|alert/);
});

test('focus stays visible on both fields and both buttons, with the focused field pair restated', () => {
    for (const field of [SELECT, NOTES]) {
        expect(declsFor(at(`${field}:focus`))).toMatchObject({
            color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)', outline: '2px solid var(--oe-wb-petrol)', 'outline-offset': expect.any(String),
        });
    }
    expect(declsFor(at(`${BUTTON}:focus-visible`))).toMatchObject({ outline: '2px solid var(--oe-wb-petrol)', 'outline-offset': expect.any(String) });
    expect(css()).not.toMatch(/outline:\s*(0|none)/);
});

test('jsdom: rules only match under the context marker plus the route body', () => {
    const { document } = new JSDOM('').window;
    const selectors = rules().flatMap(r => r.selectors).filter(s => s.endsWith('.oe-void-document'));
    const matches = (htmlClass, bodyClass) => {
        document.documentElement.className = htmlClass;
        document.body.className = bodyClass;
        document.body.innerHTML = '<div class="container-fluid oe-void-document"></div>';
        const sheet = document.querySelector('.oe-void-document');
        return selectors.some(s => sheet.matches(s));
    };
    expect(matches('oe-workbench-context oe-workbench-popup', 'oe-void-dialog')).toBe(true);
    expect(matches('oe-workbench-context', 'oe-void-dialog')).toBe(true);
    expect(matches('oe-workbench-popup', 'oe-void-dialog')).toBe(false);
    expect(matches('', 'oe-void-dialog')).toBe(false);
    expect(matches('oe-workbench-context', 'oe-disclosure-editor')).toBe(false);
});

// Real popup.js controllers in real JSDOM windows wired as the browser exposes them. The shell is
// synthetic: tests toggle its workbench-active class by hand; mode.js itself is not exercised.
describe('route sheet follows the real production popup.js context', () => {
    const ORIGIN = 'https://emr.test';
    const makeWindow = (markup, { url = `${ORIGIN}/interface/patient_file/void_dialog.php`, parent, opener, frameElement } = {}) => {
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
    const route = '<body class="oe-void-dialog"><div class="container-fluid oe-void-document"><form method="post"><center>'
        + "<table border='0' class='oe-void-fields'><tr><td>r</td></tr></table></center></form></div></body>";
    const controller = win => {
        jest.resetModules();
        return require('../../interface/clinical-workspace/popup.js').createPopupController({ win });
    };
    const engaged = win => {
        const sheet = win.document.querySelector('.oe-void-document');
        return rules().flatMap(r => r.selectors).filter(s => s.endsWith(' .oe-void-document')).some(s => sheet.matches(s));
    };
    const flush = () => new Promise(resolve => setTimeout(resolve, 0));

    test('the dlgopen dialog frame of an active workbench engages the sheet', () => {
        const shell = makeShell();
        const win = makeWindow(route, { parent: shell, frameElement: shell.document.querySelector('iframe.modalIframe') });
        expect(controller(win).active).toBe(true);
        expect([...win.document.documentElement.classList].sort()).toEqual(['oe-workbench-context', 'oe-workbench-popup']);
        expect(engaged(win)).toBe(true);
    });

    test('switching the shell to legacy and back removes and restores the sheet', async () => {
        const shell = makeShell();
        const win = makeWindow(route, { parent: shell, frameElement: shell.document.querySelector('iframe.modalIframe') });
        controller(win);
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
        const dialogWin = makeWindow(route, { parent: inactive, frameElement: inactive.document.querySelector('iframe.modalIframe') });
        expect(controller(dialogWin).active).toBe(false);
        expect(engaged(dialogWin)).toBe(false);

        const standalone = makeWindow(route);
        controller(standalone);
        expect(engaged(standalone)).toBe(false);

        const opened = makeWindow(route, { opener: makeWindow('<body class="body_top"></body>') });
        controller(opened);
        expect(engaged(opened)).toBe(false);
    });

    test('popup.js only toggles classes on <html>: body, form, controls and opener are untouched', () => {
        const shell = makeShell();
        const win = makeWindow(route, { parent: shell, frameElement: shell.document.querySelector('iframe.modalIframe') });
        const before = win.document.body.outerHTML;
        controller(win).dispose();
        expect(win.document.body.outerHTML).toBe(before);
        expect([...win.document.documentElement.classList]).toEqual([]);
    });
});

// Declared-box estimate (16px rem; label widths approximate), not a browser layout measurement.
describe.each([146, 180])('narrow %ipx frame: declared-box estimate', width => {
    const px = value => {
        // auto inline margins resolve to 0 when the frame is narrower than the sheet's max-width.
        if (value === '0' || value === 'auto') return 0;
        const m = String(value).match(/^(\d*\.?\d+)(px|rem)$/);
        expect(m).not.toBeNull();
        return Number(m[1]) * (m[2] === 'rem' ? 16 : 1);
    };

    test('the original input buttons wrap at full size inside the sheet', () => {
        const body = declsFor(SCOPE);
        const sheet = declsFor(at('.oe-void-document'));
        const inner = width - 2 * px(body.margin) - 2 * px(sheet['margin-inline'] ?? '0')
            - 2 * px(sheet['padding-inline']) - 2 * px(sheet.border.split(' ')[0]);
        // "Submit"/"Cancel" native buttons are roughly 60-70px; leave room for translations.
        expect(inner).toBeGreaterThanOrEqual(100);
        const button = declsFor(at(BUTTON));
        // Inline flow: the collapsible newline after &nbsp; is the break opportunity between them.
        expect(button).toMatchObject({ 'max-width': '100%' });
        expect(button['font-size']).toBeUndefined();
        expect(button.width).toBeUndefined();
        expect(button.padding).toBeUndefined();
        expect(button.display).toBeUndefined();
        expect(declsFor(at('.oe-void-actions')).display).toBeUndefined();
    });
});

test('stylelint: the new sheet lints clean under the repo config without a new override', () => {
    const rc = JSON.parse(read('.stylelintrc.json'));
    expect(JSON.stringify(rc.overrides)).not.toContain('void');
    const bin = path.join(path.dirname(require.resolve('stylelint/package.json')), 'bin/stylelint.mjs');
    const configBasedir = path.resolve(path.dirname(require.resolve('stylelint-config-standard')), '../..');
    const run = spawnSync(process.execPath, [bin, '--config', path.join(root, '.stylelintrc.json'), '--config-basedir', configBasedir, '--formatter', 'json', path.join(root, SHEET)], { encoding: 'utf8' });
    expect(run.error).toBeUndefined();
    const report = JSON.parse(run.stderr || run.stdout);
    expect(report.flatMap(r => [...r.parseErrors, ...r.invalidOptionWarnings, ...r.warnings.map(w => `${w.rule}: ${w.text}`)])).toEqual([]);
    expect(run.status).toBe(0);
});
