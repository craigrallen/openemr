/** @jest-environment jsdom */

// OPEMR-3: document-shaped Billing Note popup (interface/patient_file/history/edit_billnote.php).
// Source-level checks only: compiled-theme contrast, native rendering, keyboard and real
// Save/Cancel/opener behaviour are not exercised here (see docs/clinical-ui/BILLING-NOTE-POPUP.md).

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const route = 'interface/patient_file/history/edit_billnote.php';
const source = () => read(route);
const original = () => read('tests/clinical-ui/fixtures/billing-note-original.txt');
const caller = () => read('interface/patient_file/history/encounters.php');
const helper = () => read('src/Common/Assets/ClinicalWorkspaceAssets.php');
const css = () => read('interface/clinical-workspace/billing-note-popup.css');
const popupCss = () => read('interface/clinical-workspace/popup.css');

const asset = 'billing-note-popup.css';
const scope = 'html.oe-workbench-context.oe-workbench-popup body.oe-billing-note';
const count = (text, part) => text.split(part).length - 1;

// Every permitted production edit is [original, presented]: two imports, the versioned
// screen-only link after the shared Header, and presentation classes on existing elements.
const changes = [
    ['use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;', 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;'],
    ['use OpenEMR\\Core\\Header;\n', 'use OpenEMR\\Core\\Header;\nuse OpenEMR\\Core\\OEGlobalsBag;\n'],
    ['    <?php Header::setupHeader(); ?>\n</head>', `    <?php Header::setupHeader(); ?>\n    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/${asset}?v=<?php echo attr_url($clinicalAssets->version('${asset}')); ?>">\n</head>`],
    ['\n<body>\n', '\n<body class="oe-billing-note">\n'],
    ['    <div class="container">\n', '    <div class="container oe-billing-note-sheet">\n'],
    ["onsubmit='return top.restoreSession()'>", "onsubmit='return top.restoreSession()' class='oe-billing-note-form'>"],
    ['<div class="btn-group btn-group-sm mt-3">', '<div class="btn-group btn-group-sm mt-3 oe-billing-note-actions">'],
];

// Apply the declared edits to the original; throws if an anchor is missing or ambiguous.
const present = text => changes.reduce((out, [before, after]) => {
    if (count(out, before) !== 1) throw new Error(`anchor not unique: ${before}`);
    return out.replace(before, () => after);
}, text);

// Undo the declared edits; null when any presented form is missing or ambiguous.
const restore = text => {
    let out = text;
    for (const [before, after] of [...changes].reverse()) {
        if (count(out, after) !== 1) return null;
        out = out.replace(after, () => before);
    }
    return out;
};

// Behaviour the presentation slice must never touch. Each anchor occurs exactly once.
const mutations = [
    ['acct/bill write ACL', "AclMain::aclCheckCore('acct', 'bill', '', 'write')", "AclMain::aclCheckCore('acct', 'bill', '', 'view')"],
    ['denied template', 'AccessDeniedHelper::denyWithTemplate(', 'error_log('],
    ['POST CSRF check', '        CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);\n', ''],
    ['POST CSRF source', 'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true)', 'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true)'],
    ['feid integer parse', "$feid = $_GET['feid'] + 0;", "$feid = $_GET['feid'];"],
    ['feid update binding', '"SET billing_note = ? WHERE id = ?", [$fenote,$feid]', '"SET billing_note = ? WHERE id = ?", [$fenote,$_GET[\'feid\']]'],
    ['update statement', 'sqlStatement("UPDATE form_encounter " .', 'sqlQuery("UPDATE form_encounter " .'],
    ['escaped textarea', '<?php echo text($fenote); ?></textarea>', '<?php echo $fenote; ?></textarea>'],
    ['textarea identity', "<textarea class='form-control' name='form_note' id='form_note' rows='4'>", "<textarea class='form-control' name='form_note' id='form_note' rows='8'>"],
    ['autosize lookup', "const ta = document.getElementById('form_note');", "const ta = document.querySelector('textarea');"],
    ['autosize height', "ta.style.height = Math.min(ta.scrollHeight + 2, window.parent.innerHeight * 0.7) + 'px';", "ta.style.height = Math.min(ta.scrollHeight + 2, window.parent.innerHeight * 0.9) + 'px';"],
    ['hidden CSRF token', '<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />', '<input type="text" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />'],
    ['session restore', "onsubmit='return top.restoreSession()'", "onsubmit='return true'"],
    ['form action', "action='edit_billnote.php?feid=<?php echo attr_url($feid); ?>'", "action='edit_billnote.php'"],
    ['Save submit', "<button type='submit' class='btn btn-primary btn-save btn-sm' name='form_submit'", "<button type='button' class='btn btn-primary btn-save btn-sm' name='form_submit'"],
    ['Cancel submit', "<button type='submit' class='btn btn-secondary btn-cancel btn-sm' name='form_cancel'", "<button type='button' class='btn btn-secondary btn-cancel btn-sm' name='form_cancel'"],
    ['dlgclose', 'echo "dlgclose();";', 'echo "window.close();";'],
    ['exit after close', '        exit();\n', ''],
    ['shared Header', '<?php Header::setupHeader(); ?>', "<?php Header::setupHeader(['no_main-theme']); ?>"],
];

// Stray presentation edits outside the declared list are also caught.
const strays = [
    ['textarea class', "class='form-control' name='form_note'", "class='form-control oe-billing-note-text' name='form_note'"],
    ['heading typography', "<h2><?php echo xlt('Billing Note'); ?></h2>", "<h2 class=\"h5\"><?php echo xlt('Billing Note'); ?></h2>"],
    ['shared workspace sheet', '</head>', '<link rel="stylesheet" href="/interface/clinical-workspace/workspace.css">\n</head>'],
    ['inline style', '<body class="oe-billing-note">', '<body class="oe-billing-note" style="font-size:13px">'],
];

// The actual caller: dlgopen modal-sm, initial height 350, reload when the dialog closes.
const callerBlock = "const url = 'edit_billnote.php?feid=' + encodeURIComponent(this.id);\n        dlgopen(url, '', 'modal-sm', 350, false, '', {\n            onClosed: 'reload',\n        });";
const callerMutations = [
    ["'modal-sm', 350", "'modal-lg', 350"],
    ["'modal-sm', 350", "'modal-sm', 500"],
    ["onClosed: 'reload',", ''],
];

// Supported basenames on master 18647270, before this slice.
const originalAssets = [
    'ajtooltip.js', 'appointment.css', 'calendar-sidebar.js', 'calendar-workday.css', 'calendar-workday.js',
    'encounter-document.css', 'finder.css', 'global-messages.css', 'history-document.css', 'history-editor.css',
    'issue-popup.css', 'lbf-document.css', 'mode.js', 'patient-messages.css', 'patient-picker-popup.css',
    'patient-results-popup.css', 'patient-search.css', 'soap-document.css', 'soap-document.js', 'soap-reference.css',
    'soap-reference.js', 'visit-history.css', 'visit-history.js', 'workspace.css',
];
const supportedAssets = text => {
    const block = text.match(/private const SUPPORTED = \[\n([\s\S]*?)\n\s*\];/);
    if (!block) return null;
    return block[1].split('\n').map(line => line.trim()).filter(Boolean).map(line => {
        const entry = line.match(/^'([\w.-]+)',$/);
        return entry ? entry[1] : `INVALID:${line}`;
    });
};

describe('baseline and negative controls (independent of the presentation edits)', () => {
    test('the fixture is the untouched original route with unique anchors', () => {
        const text = original();
        expect(text.endsWith('</html>\n')).toBe(true);
        expect(text).not.toMatch(/\r|\t|[ ]+\n/);
        for (const marker of ['oe-billing-note', 'ClinicalWorkspaceAssets', 'OEGlobalsBag', asset, 'workspace.css', 'popup.css']) {
            expect(text).not.toContain(marker);
        }
        for (const [before] of changes) expect(count(text, before)).toBe(1);
        for (const [, from] of mutations) expect(count(text, from)).toBe(1);
        expect(count(text, '<body')).toBe(1);
        expect(count(text, '</body>')).toBe(2); // the save/cancel response closes the same body early
    });

    test('the declared edit list is self-inverse on the fixture', () => {
        const presented = present(original());
        expect(presented).not.toBe(original());
        expect(restore(presented)).toBe(original());
        for (const [, after] of changes) expect(count(presented, after)).toBe(1);
    });

    test.each(mutations)('mutation control: %s breaks restoration', (_, from, to) => {
        const presented = present(original());
        expect(count(presented, from)).toBe(1);
        expect(restore(presented.replace(from, () => to))).not.toBe(original());
    });

    test.each(strays)('stray edit control: %s breaks restoration', (_, from, to) => {
        const presented = present(original());
        expect(count(presented, from)).toBe(1);
        expect(restore(presented.replace(from, () => to))).not.toBe(original());
    });

    test('the caller opens the popup as modal-sm, 350 high, and reloads on close', () => {
        const text = caller();
        expect(count(text, callerBlock)).toBe(1);
        for (const [from, to] of callerMutations) {
            expect(count(callerBlock, from)).toBe(1);
            expect(count(text.replace(callerBlock, () => callerBlock.replace(from, () => to)), callerBlock)).toBe(0);
        }
    });

    test('the shared Header still loads the popup context and frame', () => {
        const config = read('config/config.yaml');
        expect(config).toMatch(/^\s*script: popup\.js$/m);
        expect(config).toMatch(/^\s*link: popup\.css$/m);
        expect(popupCss()).toContain('  html.oe-workbench-popup body {\n');
        expect(read('interface/clinical-workspace/popup.js')).toContain("const POPUP_CLASS = 'oe-workbench-popup';");
    });
});

describe('route presentation edits (RED until implemented)', () => {
    test('production is exactly the original plus the declared edits, and nothing else', () => {
        const php = source();
        for (const [, after] of changes) expect(count(php, after)).toBe(1);
        for (const [, from] of mutations) expect(count(php, from)).toBe(1);
        expect(php).toBe(present(original()));
        expect(restore(php)).toBe(original());
    });

    test('the sheet is linked once, versioned, screen only and after the shared Header', () => {
        const php = source();
        expect(count(php, asset)).toBe(2);
        const link = php.indexOf(`/interface/clinical-workspace/${asset}?v=`);
        expect(link).toBeGreaterThan(php.indexOf('<?php Header::setupHeader(); ?>'));
        expect(link).toBeLessThan(php.indexOf('</head>'));
        expect(php).toContain('<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>');
        expect(php).not.toMatch(/\$webroot|\$GLOBALS|workspace\.css|clinical-workspace\/popup\.css/);
        expect(count(php, '<body class="oe-billing-note">')).toBe(1);
    });

    test('the asset helper lists the original entries plus exactly the new sheet, sorted', () => {
        const actual = supportedAssets(helper());
        const expected = [...originalAssets, asset].sort();
        expect(actual).toEqual(expected);
        expect([...actual].sort()).toEqual(actual);
        expect(new Set(actual).size).toBe(actual.length);
    });
});

// ---- Stylesheet acceptance (RED until billing-note-popup.css exists) ----

const rules = () => {
    const out = [];
    postcss.parse(css()).walkRules(rule => {
        const decls = {};
        rule.walkDecls(d => { decls[d.prop] = d.value; });
        const media = [];
        for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) media.push(p.params);
        out.push({ selectors: rule.selectors, decls, media });
    });
    return out;
};
const declsFor = selector => Object.assign({}, ...rules().filter(r => r.selectors.includes(selector)).map(r => r.decls));
const controlSelector = /#form_note|textarea|\.form-control|\.btn\b|\.btn-save|\.btn-cancel|\.btn-primary|\.btn-secondary/;
const validationExclusion = ':not(.is-invalid, .is-valid, .was-validated *)';

// Popup frame tokens, as restated by the shared popup.css :root-equivalent block.
const tokens = () => {
    const out = {};
    postcss.parse(popupCss()).walkRules(rule => {
        if (!rule.selectors.includes('html.oe-workbench-context')) return;
        rule.walkDecls(/^--oe-wb-/, d => { out[d.prop] = d.value; });
    });
    return out;
};
const hex = value => {
    const short = value.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    const full = short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : value;
    return [1, 3, 5].map(i => parseInt(full.slice(i, i + 2), 16));
};
const luminance = rgb => {
    const [r, g, b] = rgb.map(c => c / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (fg, bg) => {
    const [a, b] = [luminance(hex(fg)), luminance(hex(bg))].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
};
const token = value => {
    const name = value.match(/^var\((--oe-wb-[\w-]+)\)$/)?.[1];
    return name ? tokens()[name] : undefined;
};

describe('billing note stylesheet (RED until created)', () => {
    test('one screen block, no print, imports, fonts or suppressions', () => {
        const tree = postcss.parse(css());
        const top = tree.nodes.filter(node => node.type !== 'comment');
        expect(top).toHaveLength(1);
        expect(top[0].type).toBe('atrule');
        expect(top[0].name).toBe('media');
        expect(top[0].params).toBe('screen');
        tree.walkAtRules(at => {
            if (at === top[0]) return;
            expect(at.name).toBe('media');
            expect(at.params).toMatch(/^\(max-width: \d+px\)$/);
        });
        expect(css()).not.toMatch(/@media\s+print|@import|@font-face|stylelint-|eslint-|!important/i);
    });

    test('every selector is inside the workbench popup context scope', () => {
        const all = rules();
        expect(all.length).toBeGreaterThan(5);
        for (const { selectors, media } of all) {
            expect(media).toContain('screen');
            for (const selector of selectors) {
                expect(selector === scope || selector.startsWith(`${scope} `)).toBe(true);
            }
        }
    });

    test('legacy, context-only and popup-only documents never match the scope', () => {
        const states = [
            ['', '', false],
            ['oe-workbench-context', 'oe-billing-note', false],
            ['oe-workbench-popup', 'oe-billing-note', false],
            ['oe-workbench-context oe-workbench-popup', '', false],
            ['oe-workbench-context oe-workbench-popup', 'oe-billing-note', true],
        ];
        for (const [htmlClass, bodyClass, expected] of states) {
            document.documentElement.className = htmlClass;
            document.body.className = bodyClass;
            document.body.innerHTML = '<div class="container oe-billing-note-sheet"></div>';
            expect(document.body.matches(scope)).toBe(expected);
            expect(document.querySelector('.oe-billing-note-sheet').matches(`${scope} .oe-billing-note-sheet`)).toBe(expected);
        }
    });

    test('canvas body and paper sheet use paired popup tokens with modest block padding', () => {
        expect(declsFor(scope)).toMatchObject({ color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-canvas)' });
        const sheet = declsFor(`${scope} .oe-billing-note-sheet`);
        expect(sheet).toMatchObject({ color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-paper)', border: '1px solid var(--oe-wb-line)' });
        expect(sheet['border-radius']).toMatch(/^\d+px$/);
        // Inline gutters stay Bootstrap's .container padding ($grid-gutter-width / 2: 15px, compact 10px).
        for (const prop of ['padding', 'padding-left', 'padding-right', 'padding-inline', 'margin', 'margin-left', 'margin-right', 'margin-inline', 'width', 'max-width']) {
            expect(sheet[prop]).toBeUndefined();
        }
        const block = ['padding-top', 'padding-bottom', 'padding-block'].map(p => sheet[p]).filter(Boolean);
        expect(block.length).toBeGreaterThan(0);
        for (const value of block) {
            for (const part of value.split(/\s+/)) {
                const length = part.match(/^(\d*\.?\d+)(px|rem)$/);
                expect(length).not.toBeNull();
                expect(Number(length[1]) * (length[2] === 'rem' ? 16 : 1)).toBeLessThanOrEqual(24);
            }
        }
    });

    test('the note textarea pairs ink and paper at rest, on focus, disabled, and for its placeholder', () => {
        const rest = declsFor(`${scope} #form_note`);
        expect(rest).toMatchObject({ color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-paper)' });
        const focus = declsFor(`${scope} #form_note:focus`);
        expect(focus).toMatchObject({ color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-paper)' });
        expect(focus.outline).toMatch(/var\(--oe-wb-petrol\)/);
        expect(declsFor(`${scope} #form_note:disabled`)).toMatchObject({ color: 'var(--oe-wb-disabled-ink)', 'background-color': 'var(--oe-wb-disabled-paper)' });
        expect(declsFor(`${scope} #form_note::placeholder`)).toMatchObject({ color: 'var(--oe-wb-muted)', opacity: '1' });
    });

    test('source token pairs meet 4.5:1 (source only, not compiled-theme or native contrast)', () => {
        const pairs = rules().map(r => r.decls).filter(d => d.color && d['background-color']);
        expect(pairs.length).toBeGreaterThanOrEqual(4);
        for (const d of pairs) {
            const fg = token(d.color);
            const bg = token(d['background-color']);
            expect(fg).toMatch(/^#[0-9a-f]{3,6}$/i);
            expect(bg).toMatch(/^#[0-9a-f]{3,6}$/i);
            expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(tokens()['--oe-wb-muted'], tokens()['--oe-wb-paper'])).toBeGreaterThanOrEqual(4.5);
    });

    test(':focus fallback and :focus-visible rules are separate, and actions get both', () => {
        for (const { selectors } of rules()) {
            const visible = selectors.filter(s => s.includes(':focus-visible'));
            if (visible.length) expect(visible).toHaveLength(selectors.length);
        }
        const actionFocus = declsFor(`${scope} .oe-billing-note-actions .btn:focus`);
        const actionVisible = declsFor(`${scope} .oe-billing-note-actions .btn:focus-visible`);
        expect(actionFocus.outline).toMatch(/var\(--oe-wb-petrol\)/);
        expect(actionVisible.outline).toMatch(/var\(--oe-wb-petrol\)/);
        for (const decls of [actionFocus, actionVisible]) {
            expect(Object.keys(decls).every(prop => ['outline', 'outline-offset'].includes(prop))).toBe(true);
        }
    });

    test('original actions may wrap in a narrow frame without changing the group or palettes', () => {
        const actions = declsFor(`${scope} .oe-billing-note-actions`);
        expect(actions['flex-wrap']).toBe('wrap');
        expect(actions.display).toBeUndefined();
        for (const { selectors, decls } of rules()) {
            if (!selectors.some(s => /\.btn\b|\.btn-save|\.btn-cancel|\.btn-primary|\.btn-secondary/.test(s))) continue;
            for (const prop of ['color', 'background', 'background-color', 'border', 'border-color', 'box-shadow']) {
                expect(decls[prop]).toBeUndefined();
            }
        }
    });

    test('no new control geometry, typography or hidden states', () => {
        for (const { selectors, decls } of rules()) {
            for (const prop of ['font', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform']) {
                expect(decls[prop]).toBeUndefined();
            }
            if (selectors.some(s => controlSelector.test(s))) {
                for (const prop of ['width', 'min-width', 'max-width', 'height', 'min-height', 'max-height', 'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right', 'margin', 'resize']) {
                    expect(decls[prop]).toBeUndefined();
                }
            }
            expect(String(decls.display ?? '')).not.toMatch(/none/);
            expect(decls.visibility).toBeUndefined();
            expect(decls.position).toBeUndefined();
            expect(decls['pointer-events']).toBeUndefined();
        }
    });

    test('validation borders, rings and icons stay Bootstrap-owned', () => {
        for (const { selectors, decls } of rules()) {
            for (const selector of selectors) {
                const mentions = selector.replace(validationExclusion, '');
                expect(mentions).not.toMatch(/is-invalid|is-valid|was-validated|:invalid|:valid/);
                if (controlSelector.test(selector) && ['border', 'border-color', 'box-shadow', 'background-image', 'background'].some(p => decls[p] !== undefined)) {
                    expect(selector).toContain(validationExclusion);
                }
            }
        }
    });
});
