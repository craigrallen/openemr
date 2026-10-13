/** @jest-environment node */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const LIST = 'interface/patient_file/summary/list_amendments.php';
const EDIT = 'interface/patient_file/summary/add_edit_amendments.php';
const SHEET = 'interface/clinical-workspace/amendments-popup.css';
const css = () => read(SHEET);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const count = (text, part) => text.split(part).length - 1;

// sha256 of each route at master 18647270, before the workbench presentation edits.
const baseline = {
    [LIST]: '5b13545c42bfcd3526a9bc5c4c3ad684848f3098e5e2503915e58638e8ce4017',
    [EDIT]: '6d33566dbcaef04f44d2a542e26b502392bc10996d507b81704c5f0664c94554',
};

const link = '<?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n'
    + '<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/amendments-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'amendments-popup.css\')); ?>">\n';

// Every edit is [original, presented]: one use line, one versioned link, and classes on existing elements.
const changes = {
    [LIST]: [
        ['use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Core\\Header;', 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Core\\Header;'],
        ['echo "<title>" . xlt(\'Amendment List\') . "</title>";\n?>\n', `echo "<title>" . xlt('Amendment List') . "</title>";\n?>\n${link}`],
        ["<body>\n    <div class=\"container\">\n        <div class=\"row\">\n            <div class=\"col-12\">\n                <h2><?php echo xlt('List'); ?></h2>",
            "<body class=\"oe-amendments-list\">\n    <div class=\"container oe-amendments-sheet\">\n        <div class=\"row\">\n            <div class=\"col-12\">\n                <h2 class=\"oe-amendments-title\"><?php echo xlt('List'); ?></h2>"],
        ['<div class="table-responsive">\n                        <table class="table">\n                            <tr>\n                                <td>\n',
            '<div class="table-responsive">\n                        <table class="table oe-amendments-toolbar">\n                            <tr>\n                                <td class="oe-amendments-actions">\n'],
        ['<td class="text-right">\n                                    <a href="#" class="small" onClick="checkUncheck(1);">',
            '<td class="text-right oe-amendments-selection">\n                                    <a href="#" class="small" onClick="checkUncheck(1);">'],
        ['<div id="patient_stats" class="table-responsive">\n                        <br />\n                        <table class="table table-borderless mb-3">',
            '<div id="patient_stats" class="table-responsive oe-amendments-register">\n                        <br />\n                        <table class="table table-borderless mb-3 oe-amendments-rows">'],
        ['<?php } else { ?>\n                    <div class="btn-group">', '<?php } else { ?>\n                    <div class="btn-group oe-amendments-actions">'],
        ['<p class="text-danger">\n                        <?php echo xlt("No amendment requests available"); ?>',
            '<p class="text-danger oe-amendments-empty">\n                        <?php echo xlt("No amendment requests available"); ?>'],
    ],
    [EDIT]: [
        ['use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;', 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;'],
        ['echo "<title>" . xlt(\'Amendments\') . "</title>";\n?>\n', `echo "<title>" . xlt('Amendments') . "</title>";\n?>\n${link}`],
        ["<body>\n    <div class=\"container\">\n        <div class=\"row\">\n            <div class=\"col-12\">\n                <h2><?php echo xlt('Amendments'); ?></h2>",
            "<body class=\"oe-amendments-editor\">\n    <div class=\"container oe-amendments-sheet\">\n        <div class=\"row\">\n            <div class=\"col-12\">\n                <h2 class=\"oe-amendments-title\"><?php echo xlt('Amendments'); ?></h2>"],
        ['<div class="btn-group">\n                    <?php if (! $onlyRead) { ?>', '<div class="btn-group oe-amendments-actions">\n                    <?php if (! $onlyRead) { ?>'],
        ['id="add_edit_amendments" method="post"', 'id="add_edit_amendments" class="oe-amendments-form" method="post"'],
        ...['Requested Date', 'Requested By', 'Request Description', 'Request Status', 'Comments'].map(label => [
            `<div class="form-group mt-3">\n                        <label><?php echo xlt('${label}'); ?></label>`,
            `<div class="form-group mt-3 oe-amendments-field">\n                        <label><?php echo xlt('${label}'); ?></label>`,
        ]),
        ['<h2><?php echo xlt("History") ; ?></h2>', '<h2 class="oe-amendments-title"><?php echo xlt("History") ; ?></h2>'],
        ['<table class="table table-bordered table-hover">', '<table class="table table-bordered table-hover oe-amendments-history">'],
    ],
};

// Undo the presentation edits; returns null when any edit is missing or ambiguous.
const restore = (file, text) => {
    let restored = text;
    for (const [before, after] of changes[file]) {
        if (count(restored, after) !== 1) return null;
        restored = restored.replace(after, () => before);
    }
    return restored;
};

describe.each([LIST, EDIT])('%s', file => {
    test('only the declared asset and class edits restore the exact original route', () => {
        const php = read(file);
        for (const [, after] of changes[file]) expect(count(php, after)).toBe(1);
        expect(sha(restore(file, php))).toBe(baseline[file]);
    });

    test('the sheet is linked once, screen only and versioned through the asset helper', () => {
        const php = read(file);
        expect(count(php, 'amendments-popup.css')).toBe(2);
        expect(count(php, link)).toBe(1);
        expect(php).not.toMatch(/amendments-popup\.css\?v=(?!<\?php echo attr_url\(\$clinicalAssets)/);
        // The shared workspace sheet changes inherited typography and print; it is never linked here.
        expect(php).not.toMatch(/clinical-workspace\/(workspace|popup)\.css/);
        // The link follows Header::setupHeader so the route sheet wins over the theme sheet.
        expect(php.indexOf('amendments-popup.css')).toBeGreaterThan(php.indexOf('Header::setupHeader('));
        expect(php.match(/<body[ >]/g)).toHaveLength(1);
    });
});

test('negative controls: SQL, ACL, CSRF, session, callbacks or scripts cannot change unnoticed', () => {
    const mutations = {
        [LIST]: [
            ["AclMain::aclCheckCore('patients', 'amendment')", "AclMain::aclCheckCore('patients', 'demo')"],
            ['ORDER BY amendment_date DESC', 'ORDER BY amendment_date ASC'],
            ["$session->get('pid', 0)", "$session->get('pid', 1)"],
            ["onsubmit='return top.restoreSession()'", "onsubmit='return true'"],
            ['$("#list_amendments input:checkbox:checked")', '$("input:checkbox:checked")'],
            ['onClick="checkUncheck(1);"', 'onClick="checkUncheck(0);"'],
            ['href="javascript:checkForAmendments();"', 'href="#"'],
            ['window.open(url);', 'window.location = url;'],
            ['<input id="check_list[]" name="check_list[]" type="checkbox"', '<input id="check_list[]" name="check_list" type="checkbox"'],
            ['<a href="demographics.php" class="btn btn-secondary">', '<a href="demographics.php" class="btn btn-secondary oe-extra">'],
        ],
        [EDIT]: [
            ["CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);", ''],
            ['CsrfUtils::collectCsrfToken(session: $session)', "''"],
            ["AclMain::aclCheckCore('patients', 'amendment', '', 'write')", "AclMain::aclCheckCore('patients', 'amendment')"],
            ['\t\t\tpid = ?,\n\t\t\tamendment_desc = ?,', '\t\t\tamendment_desc = ?,\n\t\t\tpid = ?,'],
            ['INSERT INTO amendments_history SET', 'REPLACE INTO amendments_history SET'],
            ["$onlyRead = ( $onlyRead || (!empty($amendment_status)) ) ? 1 : 0;", '$onlyRead = 0;'],
            ['["disabled" => "true"]', '["readonly" => "true"]'],
            ['<?php echo ( $onlyRead ) ? "readonly" : "";  ?> id="desc"', 'id="desc"'],
            ['onclick="formValidation()"', 'onclick="$(\'#add_edit_amendments\').submit()"'],
            ["$(\"#note\").val($(\"#note\").val() + ' ' + statusText);", ''],
            ['<?php $datetimepicker_timepicker = false; ?>', '<?php $datetimepicker_timepicker = true; ?>'],
            ['echo "<tr>";\n                    }', 'echo "</tr>";\n                    }'],
            ['<input type="hidden" id="mode" name="mode" value=""/>', ''],
        ],
    };
    for (const file of [LIST, EDIT]) {
        const php = read(file);
        for (const [from, to] of mutations[file]) {
            expect(count(php, from)).toBe(1);
            const restored = restore(file, php.replace(from, () => to));
            expect(restored === null ? null : sha(restored)).not.toBe(baseline[file]);
        }
    }
    // A stray class outside the declared list is caught too.
    const edit = read(EDIT);
    expect(sha(restore(EDIT, edit.replace('id="note" class="form-control"', 'id="note" class="form-control oe-extra"')))).not.toBe(baseline[EDIT]);
});

test('the asset helper allowlists exactly the new basename', () => {
    const helper = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
    expect(helper).toMatch(/\n {8}'ajtooltip\.js',\n {8}'amendments-popup\.css',\n {8}'appointment\.css',\n/);
    expect(count(helper, 'amendments')).toBe(1);
});

// The demographics card links load these routes in the normal patient content frame, not a dialog,
// so the scope is popup.js's context marker, which it sets for frames and popups of an active workbench.
const scopes = ['html.oe-workbench-context body.oe-amendments-list', 'html.oe-workbench-context body.oe-amendments-editor'];
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
const anyScope = part => scopes.map(scope => `${scope} ${part}`);

test('the sheet is one screen block, positive-scoped to the workbench context marker and a route body', () => {
    const tree = postcss.parse(css());
    const top = tree.nodes.filter(node => node.type !== 'comment');
    expect(top).toHaveLength(1);
    expect(top[0].type === 'atrule' && top[0].name === 'media' && top[0].params).toBe('screen');
    const media = [];
    tree.walkAtRules(at => media.push(`${at.name} ${at.params}`));
    expect(media).toEqual(['media screen']);
    const all = rules();
    expect(all.length).toBeGreaterThan(15);
    for (const { selectors } of all) {
        for (const selector of selectors) {
            expect(scopes.some(scope => selector === scope || selector.startsWith(`${scope} `))).toBe(true);
            expect(selector).not.toMatch(/oe-clinical-workspace|workbench-active|oe-workbench-popup/);
        }
    }
});

test('presentation never hides, clips, disables or reorders route content', () => {
    for (const { decls } of rules()) {
        expect(decls.display ?? '').not.toMatch(/none|contents|!important/);
        expect(decls.visibility).toBeUndefined();
        expect(decls.order).toBeUndefined();
        expect(decls['flex-direction'] ?? '').not.toMatch(/reverse/);
        expect(decls.position ?? '').not.toMatch(/fixed|absolute|sticky/);
        expect(decls['text-overflow']).toBeUndefined();
        expect(decls['white-space'] ?? '').not.toMatch(/nowrap/);
        expect(decls.overflow ?? '').not.toMatch(/hidden|clip/);
        expect(decls.height).toBeUndefined();
        expect(decls['max-height']).toBeUndefined();
        for (const value of Object.values(decls)) expect(value).not.toMatch(/!important/);
    }
    expect(css()).not.toMatch(/pointer-events|user-select|opacity:\s*0[;\s]|content:/);
});

test('RTL: spacing and alignment are logical, never physical', () => {
    for (const { decls } of rules()) {
        for (const prop of Object.keys(decls)) {
            expect(prop).not.toMatch(/(^|-)(left|right)($|-)/);
            expect(prop).not.toMatch(/^float$/);
        }
        expect(decls['text-align'] ?? 'start').toMatch(/^(start|end|center)$/);
    }
});

test('document shape: sheet, ruled heading, field stack, register and history tables', () => {
    const selectors = rules().flatMap(r => r.selectors);
    for (const part of [
        '.oe-amendments-sheet', '.oe-amendments-title', '.oe-amendments-actions', '.oe-amendments-selection',
        '.oe-amendments-toolbar', '.oe-amendments-register', '.oe-amendments-rows', '.oe-amendments-empty',
        '.oe-amendments-form', '.oe-amendments-field', '.oe-amendments-history', 'textarea', 'thead th',
    ]) expect(selectors.some(selector => selector.includes(part))).toBe(true);

    for (const scope of scopes) {
        expect(declsFor(scope)).toMatchObject({ color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-canvas)' });
        expect(declsFor(`${scope} .oe-amendments-sheet`)).toMatchObject({ background: 'var(--oe-wb-paper)', 'border-radius': expect.any(String) });
        expect(declsFor(`${scope} .oe-amendments-title`)).toMatchObject({ color: 'var(--oe-wb-ink)', 'border-block-end': '1px solid var(--oe-wb-line)' });
        // Wrapping actions in both the toolbar cell and the button groups.
        expect(declsFor(`${scope} .btn-group.oe-amendments-actions`)).toMatchObject({ display: 'flex', 'flex-wrap': 'wrap' });
    }
    expect(declsFor(`${scopes[1]} .oe-amendments-field textarea.form-control`)).toMatchObject({ resize: 'vertical' });
    // Narrow dialog: short fields cap their width but always shrink to the frame.
    expect(declsFor(`${scopes[1]} .oe-amendments-field select.form-control`)).toMatchObject({ width: '100%', 'max-width': expect.stringMatching(/rem$/) });
    expect(declsFor(`${scopes[0]} .oe-amendments-register`)).toMatchObject({ 'overflow-x': 'auto' });
});

test('dark theme: every text-bearing descendant pairs explicit ink with a light surface', () => {
    const paired = [
        ['.oe-amendments-title', 'var(--oe-wb-ink)'],
        ['.oe-amendments-field label', 'var(--oe-wb-ink)'],
        ['thead th', 'var(--oe-wb-muted)'],
        ['tbody td', 'var(--oe-wb-ink)'],
        ['.oe-amendments-toolbar td', 'var(--oe-wb-ink)'],
        ['.oe-amendments-rows a', 'var(--oe-wb-petrol)'],
        ['.oe-amendments-selection a', 'var(--oe-wb-petrol)'],
        ['.oe-amendments-actions .btn-secondary', 'var(--oe-wb-ink)'],
        ['.oe-amendments-actions .btn-primary', 'var(--oe-wb-on-petrol)'],
    ];
    const selectors = rules().flatMap(r => r.selectors);
    for (const [part, ink] of paired) {
        const matching = selectors.filter(s => s.endsWith(` ${part}`) || s.includes(` ${part}:not(`));
        expect(matching.length).toBeGreaterThan(0);
        for (const selector of matching) expect(declsFor(selector).color).toBe(ink);
    }
    for (const part of ['thead th', 'tbody td', '.oe-amendments-actions .btn-secondary', '.oe-amendments-actions .btn-primary']) {
        for (const selector of selectors.filter(s => s.endsWith(` ${part}`))) {
            expect(declsFor(selector).background).toMatch(/^var\(--oe-wb-(paper|canvas|petrol)\)$/);
        }
    }
    // The dark theme's hover row overlay would wash out ink; the hover cell restates the pair.
    expect(declsFor(`${scopes[1]} .oe-amendments-history tbody tr:hover > td`)).toMatchObject({ color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-canvas)' });
    expect(css()).not.toMatch(/#[0-9a-f]{3,8}\b/i);
});

test('semantic, validation, disabled/readonly and focus states stay intact and visible', () => {
    const all = rules();
    const selectors = all.flatMap(r => r.selectors);
    // The empty-state warning keeps its text-danger colour.
    expect(declsFor(`${scopes[0]} .oe-amendments-empty`).color).toBeUndefined();
    for (const { selectors: s, decls } of all) {
        if (s.some(sel => /text-danger|oe-amendments-empty/.test(sel))) expect(decls.color).toBeUndefined();
    }
    // Neutral control resets exclude Bootstrap validation states.
    // Rules that only size controls (width, min-height, resize) carry no paint and are exempt.
    const paint = /^(color|background|background-color|background-image|border|border-color|outline|box-shadow)$/;
    for (const { selectors: s, decls } of all) {
        if (!Object.keys(decls).some(prop => paint.test(prop))) continue;
        for (const selector of s.filter(sel => /\.form-control/.test(sel) && !/:disabled|\[readonly\]/.test(sel))) {
            expect(selector).toContain('.form-control:not(.is-invalid, .is-valid, .was-validated *)');
        }
    }
    // Locked (read-only amendment) controls use the disabled token pair.
    for (const state of [':disabled', '[readonly]']) {
        const locked = selectors.filter(s => s.includes(`.form-control${state}`));
        expect(locked.length).toBeGreaterThan(0);
        for (const selector of locked) expect(declsFor(selector)).toMatchObject({ color: 'var(--oe-wb-disabled-ink)', background: 'var(--oe-wb-disabled-paper)' });
    }
    // Focus is drawn for controls, buttons, links and the row checkboxes.
    for (const part of ['.form-control:not(.is-invalid, .is-valid, .was-validated *):focus', '.btn:focus-visible', 'a:focus-visible', "input[type='checkbox']:focus-visible"]) {
        const focus = selectors.filter(s => s.endsWith(part));
        expect(focus.length).toBeGreaterThan(0);
        for (const selector of focus) expect(declsFor(selector).outline).toBe('2px solid var(--oe-wb-petrol)');
    }
    expect(css()).not.toMatch(/outline:\s*(0|none)/);
});

test('jsdom: rules only match under the context marker plus the route body', () => {
    const markup = '<div class="container oe-amendments-sheet"><h2 class="oe-amendments-title">t</h2></div>';
    const sheetRules = rules().flatMap(r => r.selectors).filter(s => s.endsWith('.oe-amendments-title'));
    const { document } = new JSDOM('').window;
    const matches = (htmlClass, bodyClass) => {
        document.documentElement.className = htmlClass;
        document.body.className = bodyClass;
        document.body.innerHTML = markup;
        const title = document.querySelector('.oe-amendments-title');
        return sheetRules.some(s => title.matches(s));
    };
    expect(matches('oe-workbench-context', 'oe-amendments-list')).toBe(true); // normal content frame
    expect(matches('oe-workbench-context oe-workbench-popup', 'oe-amendments-editor')).toBe(true); // dialog
    expect(matches('oe-workbench-popup', 'oe-amendments-list')).toBe(false); // popup alone never occurs and is not enough
    expect(matches('', 'oe-amendments-list')).toBe(false); // standalone / explicit legacy
    expect(matches('oe-workbench-context', 'oe-issue-editor')).toBe(false); // other routes, and the shell's own body
});

// Real popup.js controllers in real JSDOM windows wired as the browser exposes them
// (see workbench-popup.test.js): the route sheet must engage exactly when popup.js says so.
describe('route sheet follows the real popup.js context in every entry path', () => {
    const ORIGIN = 'https://emr.test';
    const makeWindow = (markup, { url = `${ORIGIN}/interface/patient_file/summary/list_amendments.php`, parent, opener, frameElement } = {}) => {
        const { window } = new JSDOM(markup, { url, runScripts: 'outside-only' });
        if (parent) Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });
        if (frameElement) Object.defineProperty(window, 'frameElement', { configurable: true, get: () => frameElement });
        if (opener) window.opener = opener;
        return window;
    };
    const makeShell = () => makeWindow(
        '<body class="workbench-active"><div id="mainBox"><button type="button" data-workbench-mode></button></div>'
        + '<div class="modal fade dialogModal"><div class="modal-dialog"><div class="modal-content">'
        + '<iframe class="modalIframe" name="editAmendments"></iframe></div></div></div><iframe name="pat"></iframe></body>',
        { url: `${ORIGIN}/interface/main/tabs/main.php` },
    );
    const route = body => `<body class="${body}"><div class="container oe-amendments-sheet"><div class="row"><div class="col-12"><h2 class="oe-amendments-title">t</h2></div></div></div></body>`;
    const controller = win => {
        jest.resetModules();
        return require('../../interface/clinical-workspace/popup.js').createPopupController({ win });
    };
    const titleSelectors = () => rules().flatMap(r => r.selectors).filter(s => s.endsWith(' .oe-amendments-title'));
    const engaged = win => {
        const title = win.document.querySelector('.oe-amendments-title');
        return titleSelectors().some(selector => title.matches(selector));
    };
    const flush = () => new Promise(resolve => setTimeout(resolve, 0));

    test('normal patient content frame (the demographics card link) engages the sheet', () => {
        const shell = makeShell();
        const tab = makeWindow(route('oe-amendments-list'), { parent: shell, frameElement: shell.document.querySelector('iframe[name="pat"]') });
        expect(controller(tab).active).toBe(true);
        expect([...tab.document.documentElement.classList]).toEqual(['oe-workbench-context']);
        expect(engaged(tab)).toBe(true);
    });

    test('a dlgopen dialog frame (.rx_modal) engages the sheet too', () => {
        const shell = makeShell();
        const dialog = makeWindow(route('oe-amendments-editor'), { parent: shell, frameElement: shell.document.querySelector('iframe.modalIframe') });
        controller(dialog);
        expect([...dialog.document.documentElement.classList]).toEqual(expect.arrayContaining(['oe-workbench-context', 'oe-workbench-popup']));
        expect(engaged(dialog)).toBe(true);
    });

    test('legacy mode and reactivation toggle the sheet with the shell', async () => {
        const shell = makeShell();
        const tab = makeWindow(route('oe-amendments-editor'), { parent: shell, frameElement: shell.document.querySelector('iframe[name="pat"]') });
        controller(tab);
        expect(engaged(tab)).toBe(true);
        shell.document.body.classList.remove('workbench-active');
        await flush();
        expect([...tab.document.documentElement.classList]).toEqual([]);
        expect(engaged(tab)).toBe(false);
        shell.document.body.classList.add('workbench-active');
        await flush();
        expect(engaged(tab)).toBe(true);
    });

    test('an inactive shell, a standalone window and a non-workbench opener stay legacy', () => {
        const inactive = makeShell();
        inactive.document.body.classList.remove('workbench-active');
        const tab = makeWindow(route('oe-amendments-list'), { parent: inactive, frameElement: inactive.document.querySelector('iframe[name="pat"]') });
        expect(controller(tab).active).toBe(false);
        expect(engaged(tab)).toBe(false);

        const standalone = makeWindow(route('oe-amendments-list'));
        controller(standalone);
        expect(engaged(standalone)).toBe(false);

        const opened = makeWindow(route('oe-amendments-editor'), { opener: makeWindow('<body class="body_top"></body>') });
        controller(opened);
        expect(engaged(opened)).toBe(false);
    });

    test('the active shell document itself never matches (wrong body)', () => {
        const shell = makeShell();
        controller(shell);
        expect(shell.document.documentElement.classList.contains('oe-workbench-context')).toBe(true);
        expect(titleSelectors().some(s => shell.document.body.matches(s.replace(/ \.oe-amendments-title$/, '')))).toBe(false);
    });
});

// Narrow frames: Bootstrap's .row gutters (-15px) must not poke past a sheet padded below 15px,
// and the history table (a flex item of .row whose table grid cannot shrink below min-content)
// must scroll inside the sheet rather than spill over its border. Layout is not measured here.
test('narrow frame: row gutters neutralised and overflow contained, never clipped', () => {
    for (const scope of scopes) {
        expect(declsFor(`${scope} .oe-amendments-sheet > .row`)).toMatchObject({ 'margin-inline': '0' });
        expect(declsFor(`${scope} .oe-amendments-sheet > .row > [class*='col']`)).toMatchObject({ 'padding-inline': '0' });
        expect(declsFor(`${scope} .oe-amendments-sheet`)).toMatchObject({ 'overflow-x': 'auto' });
    }
    expect(declsFor(`${scopes[1]} .oe-amendments-history`)).toMatchObject({ 'margin-inline': '0', 'max-width': '100%' });
    expect(declsFor(`${scopes[1]} .oe-amendments-sheet > .row > hr`)).toMatchObject({ 'margin-inline': '0', 'max-width': '100%' });
    expect(css()).not.toMatch(/30px|15px/);
});
