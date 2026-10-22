/*
 * TECH-64: source contract for the Personalize popup
 * (library/custom_template/personalize.php) in the clinical workbench.
 *
 * Standalone source tests: reads files only, no child processes or Git. The
 * fixture is the unmodified origin/master route; the presentation is limited
 * to the declared edits below, so undoing them must yield the fixture byte for
 * byte. Missing files fail as expectations, not import errors.
 *
 * Inherited and deliberately unchanged in this slice: the REQUEST save has no
 * CSRF check, only the management links are ACL gated, $_REQUEST['list_id'] is
 * read without a default, and remove_selected()/jsub_selected() rely on an
 * undefined selectFrom and the global event.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const readOrNull = file => {
    try {
        return fs.readFileSync(path.join(root, file), 'utf8');
    } catch {
        return null;
    }
};

const ROUTE = 'library/custom_template/personalize.php';
const FIXTURE = 'tests/clinical-ui/fixtures/personalize-original.txt';
const SHEET = 'interface/clinical-workspace/personalize-popup.css';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const POPUP = 'interface/clinical-workspace/popup.css';
// The theme source that paints .body_top background-color !important.
const THEME = 'interface/themes/color_base.scss';

const route = () => readOrNull(ROUTE) ?? '';
const fixture = () => readOrNull(FIXTURE) ?? '';
const sheet = () => readOrNull(SHEET) ?? '';

const count = (text, part) => text.split(part).length - 1;

// Every edit is [original, presented]: imports, one screen-only link and three classes.
const edits = [
    [
        'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Session\\SessionWrapperFactory;\nuse OpenEMR\\Core\\Header;\n',
        'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Session\\SessionWrapperFactory;\nuse OpenEMR\\Core\\Header;\nuse OpenEMR\\Core\\OEGlobalsBag;\n',
    ],
    [
        "    <?php Header::setupHeader(['common', 'opener']); ?>\n",
        "    <?php Header::setupHeader(['common', 'opener']); ?>\n"
            + '    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n'
            + '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/personalize-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'personalize-popup.css\')); ?>">\n',
    ],
    ['<body class="body_top">', '<body class="body_top oe-personalize">'],
    [
        '<form name="myform" method="post" onsubmit="top.restoreSession();">',
        '<form name="myform" method="post" onsubmit="top.restoreSession();" class="oe-personalize-document">',
    ],
    ['<div class="col-12 my-2 text-center">', '<div class="col-12 my-2 text-center oe-personalize-actions">'],
];

// Apply or undo the declared edits; null when any anchor is missing or ambiguous.
const apply = text => {
    let out = text;
    for (const [before, after] of edits) {
        if (count(out, before) !== 1) return null;
        out = out.replace(before, () => after);
    }
    return out;
};
const restore = text => {
    let out = text;
    for (const [before, after] of [...edits].reverse()) {
        if (count(out, after) !== 1) return null;
        out = out.replace(after, () => before);
    }
    return out;
};

describe('TECH-64 personalize route fixture', () => {
    test('the frozen original route is present and holds each declared original anchor once', () => {
        const original = fixture();
        expect(original.startsWith('<?php\n\n/**\n * personalize.php\n')).toBe(true);
        expect(original.endsWith('</body>\n</html>\n')).toBe(true);
        for (const [before, after] of edits) {
            expect(count(original, before)).toBe(1);
            expect(count(original, after)).toBe(0);
        }
        expect(original).not.toContain('personalize-popup.css');
    });
});

describe('TECH-64 personalize route edits', () => {
    test('every declared presentation edit appears exactly once in the route', () => {
        const php = route();
        for (const [, after] of edits) expect(count(php, after)).toBe(1);
    });

    test('undoing the declared edits restores the frozen original route byte for byte', () => {
        expect(restore(route())).toBe(fixture());
    });

    test('applying the declared edits to the frozen original yields the route byte for byte', () => {
        expect(apply(fixture())).toBe(route());
    });

    test('body keeps body_top; form and action row gain classes; no wrapper, style or script is added', () => {
        const php = route();
        const original = fixture();
        expect(php).toContain('<body class="body_top oe-personalize">');
        expect(php).toContain('class="oe-personalize-document"');
        expect(php).toContain('<div class="col-12 my-2 text-center oe-personalize-actions">');
        for (const tag of ['<body', '<form', '<div', '<select', '<button', '<a ', '<input', '<script', '<style', '<link']) {
            const expected = count(original, tag) + (tag === '<link' ? 1 : 0);
            expect([tag, count(php, tag)]).toEqual([tag, expected]);
        }
        // The theme .text label cells and the inline itemdiv height stay as shipped.
        expect(count(php, '<div class="col-sm-5 text">')).toBe(2);
        expect(php).toContain('<div class="w-100 overflow-auto" style="height:150px" id="itemdiv"></div>');
    });

    test('the sheet is linked once, screen only, versioned through the asset helper and typed webroot', () => {
        const php = route();
        expect(count(php, 'personalize-popup.css')).toBe(2);
        expect(php).toContain('use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;');
        expect(php).toContain('use OpenEMR\\Core\\OEGlobalsBag;');
        expect(php).toContain('<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/personalize-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'personalize-popup.css\')); ?>">');
        expect(php).not.toMatch(/\$GLOBALS\[|\$webroot|media="print"|media="all"/);
    });

    test('SQL, per-user writes, ACL, session, AJAX, dialog sizes, handlers and save survive verbatim', () => {
        const php = route();
        const original = fixture();
        const anchors = [
            'sqlStatement("DELETE FROM template_users WHERE tu_template_id=? AND tu_user_id=?", [$id, $session->get(\'authUserID\')]);',
            'sqlStatement("REPLACE INTO template_users (tu_template_id,tu_user_id,tu_template_order) VALUES (?,?,?)", [$id, $session->get(\'authUserID\'), $order]);',
            "if (isset($_REQUEST['submitform']) && $_REQUEST['submitform'] == 'save') {",
            "Insert_Rows($rowTU['tu_template_id'], $rowTU['tu_template_order']);",
            "Insert_Rows($row['cl_list_slno'], $row['cl_order']);",
            "AclMain::aclCheckCore('nationnotes', 'nn_configure')",
            "$session->get('authUserID')",
            "dlgopen('', '', 400, 250, '', '', {",
            "dlgopen('', '', 500, 500, '', '', {",
            "dlgopen('', '', 700, 550, '', '', {",
            'url: "ajax_code.php",',
            'source: "check_item"',
            'source: "item_show"',
            "onClosed: 'refreshme',",
            'top.restoreSession();',
            'onclick="top.restoreSession();personalize_save()"',
            '<input type="hidden" name="submitform" id="submitform" value="" />',
            'href="delete_category.php" id="share_link" class="iframe_medium btn btn-primary"',
            'href="add_template.php?list_id=<?php echo attr($_REQUEST[\'list_id\']); ?>"',
            'href="add_context.php" class="iframe_medium btn btn-primary"',
            "onchange='javascript:document.myform.submit();'",
            'name="topersonalized[]" class="form-control" id="topersonalized" size="6"',
            'name="personalized[]" id="personalized" size="6"',
        ];
        for (const anchor of anchors) {
            expect(count(original, anchor)).toBeGreaterThan(0);
            expect([anchor, count(php, anchor)]).toEqual([anchor, count(original, anchor)]);
        }
    });
});

describe('TECH-64 personalize negative controls', () => {
    // Each mutation is applied to the frozen original plus the declared edits.
    const mutations = [
        ['DELETE FROM template_users WHERE tu_template_id=? AND tu_user_id=?', 'DELETE FROM template_users WHERE tu_template_id=?'],
        ['REPLACE INTO template_users (tu_template_id,tu_user_id,tu_template_order)', 'INSERT INTO template_users (tu_template_id,tu_user_id,tu_template_order)'],
        ["if (isset($_REQUEST['submitform']) && $_REQUEST['submitform'] == 'save') {", "if (isset($_POST['submitform']) && $_POST['submitform'] == 'save') {"],
        ["Insert_Rows($row['cl_list_slno'], $row['cl_order']);", "Insert_Rows($row['cl_list_slno']);"],
        ["Insert_Rows($rowTU['tu_template_id'], $rowTU['tu_template_order']);", "Insert_Rows($rowTU['tu_template_id']);"],
        ["$list_id = $_REQUEST['list_id'] ?: $filter_context;", "$list_id = $_REQUEST['list_id'] ?? $filter_context;"],
        ['WHERE tu.tu_user_id!=?";', '";'],
        ["dlgopen('', '', 400, 250,", "dlgopen('', '', 480, 250,"],
        ["dlgopen('', '', 500, 500,", "dlgopen('', '', 725, 575,"],
        ["dlgopen('', '', 700, 550,", "dlgopen('', '', 700, 600,"],
        ['source: "check_item"', 'source: "check"'],
        ['source: "item_show"', 'source: "item"'],
        ['            tabbify();\n', ''],
        [
            "if (AclMain::aclCheckCore('nationnotes', 'nn_configure')) {\n                        ?>\n                        <a href=\"delete_category.php\"",
            "if (true) {\n                        ?>\n                        <a href=\"delete_category.php\"",
        ],
        ['<a href="add_context.php" class="iframe_medium btn btn-primary"', '<a href="add_context.php" class="iframe_small btn btn-primary"'],
        ["add_template.php?list_id=<?php echo attr($_REQUEST['list_id']); ?>", 'add_template.php?list_id=<?php echo attr($list_id); ?>'],
        ['onclick="top.restoreSession();personalize_save()"', 'onclick="personalize_save()"'],
        ['method="post"', 'method="get"'],
        ['<input type="hidden" name="submitform" id="submitform" value="" />', ''],
        ['style="height:150px" id="itemdiv"', 'style="height:300px" id="itemdiv"'],
        ["onchange=\"display_category_item(document.myform,'topersonalized');\"", ''],
        ["onclick=\"check_user_category(document.myform,'topersonalized','personalized')\"", "onclick=\"jsub_selected(document.myform,'topersonalized','personalized')\""],
        ['name="personalized[]" id="personalized" size="6"', 'name="personalized[]" id="personalized" size="10"'],
        ["<option value=''><?php echo xlt('Select a User'); ?></option>", ''],
        ['            jsub_sortNow(form.elements[selectFrom]);\n            return;\n        }\n\n        function all_selected(', '            jsub_sortNow(form.elements[selectedList]);\n            return;\n        }\n\n        function all_selected('],
        ['function jsub_selected(form, selectFrom, selectedList) {\n            event.preventDefault();\n', 'function jsub_selected(form, selectFrom, selectedList) {\n'],
        ["<div class=\"col-sm-5 text\">\n                    <?php echo xlt('Available categories'); ?>", "<div class=\"col-sm-5\">\n                    <?php echo xlt('Available categories'); ?>"],
        ["<?php Header::setupHeader(['common', 'opener']); ?>", "<?php Header::setupHeader(['opener']); ?>"],
    ];

    test.each(mutations)('mutation %# changes its anchor and breaks restoration', (from, to) => {
        const original = fixture();
        const planned = apply(original);
        expect(planned).not.toBeNull();
        expect(count(planned ?? '', from)).toBe(1);
        const mutated = (planned ?? '').replace(from, () => to);
        expect(mutated).not.toBe(planned);
        expect(restore(mutated)).not.toBe(original);
    });

    test('a stray class, link or wrapper outside the declared edits breaks restoration', () => {
        const original = fixture();
        const planned = apply(original) ?? '';
        expect(planned).not.toBe('');
        const strays = [
            planned.replace('<h3>', '<h3 class="oe-extra">'),
            planned.replace('</head>', '    <link rel="stylesheet" href="x.css">\n</head>'),
            planned.replace('<div class="container-fluid">', '<div class="oe-sheet">\n        <div class="container-fluid">'),
            planned.replace('<div class="col-sm-2 text-center">', '<div class="col-sm-2 text-center d-flex">'),
        ];
        for (const stray of strays) {
            expect(stray).not.toBe(planned);
            expect(restore(stray)).not.toBe(original);
        }
        expect(restore(planned.replace('oe-personalize-actions', 'oe-personalize-action'))).toBeNull();
        expect(restore(planned.replace('media="screen" href', 'href'))).toBeNull();
    });
});

describe('TECH-64 asset helper allowlist', () => {
    test('ClinicalWorkspaceAssets registers personalize-popup.css in sorted order', () => {
        const helper = readOrNull(HELPER) ?? '';
        expect(helper).toContain('namespace OpenEMR\\Common\\Assets;');
        const list = [...(/private const SUPPORTED = \[([\s\S]*?)\];/.exec(helper)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(m => m[1]);
        expect(list).toContain('personalize-popup.css');
        expect(list).toEqual([...list].sort());
    });
});

const scope = 'html.oe-workbench-context.oe-workbench-popup body.oe-personalize';
const control = `${scope} .oe-personalize-document .form-control`;
const enabled = `${control}:not(:disabled, .is-invalid, .is-valid, .was-validated *)`;
const requiredTokens = [
    '--oe-wb-ink', '--oe-wb-line', '--oe-wb-paper', '--oe-wb-canvas', '--oe-wb-petrol',
    '--oe-wb-disabled-ink', '--oe-wb-disabled-paper',
];
// Paint and modest box properties only: no fonts, layout, flex, sizing or behaviour.
const allowedProps = [
    'color', 'background-color', 'border', 'border-color', 'border-top', 'border-radius',
    'padding', 'padding-top', 'margin', 'outline', 'outline-offset', 'box-shadow',
];
// Script-, theme- or layout-owned hooks the sheet must leave alone.
const excludedHooks = /\.text(?![\w-])|#|\[style|\.body_top|\.row(?![\w-])|\.col-|\.btn|option|\.overflow-auto|\.w-100|\.container-fluid|\.modal|\.dialogModal|\.table/;
const importantAllowlist = [`${scope} { background-color }`];

const parse = css => {
    try {
        return postcss.parse(css);
    } catch {
        return null;
    }
};
const rulesOf = css => {
    const out = [];
    parse(css)?.walkRules(rule => {
        const media = [];
        for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) media.push(`@${p.name} ${p.params}`);
        const decls = rule.nodes.filter(node => node.type === 'decl')
            .map(decl => ({ prop: decl.prop, value: decl.value, important: Boolean(decl.important) }));
        out.push({ selectors: rule.selectors, media, decls });
    });
    return out;
};
const declarationMap = css => {
    const map = {};
    for (const rule of rulesOf(css)) {
        for (const selector of rule.selectors) {
            map[selector] = map[selector] ?? {};
            for (const decl of rule.decls) map[selector][decl.prop] = `${decl.value}${decl.important ? ' !important' : ''}`;
        }
    }
    return map;
};
const lengthsWithin = (value, maxPx) => [...value.matchAll(/(-?\d*\.?\d+)(px|rem|em|%|v[wh])?/g)]
    .every(([, number, unit]) => {
        const n = Number(number);
        if (n < 0 || unit === '%' || /^v/.test(unit ?? '')) return false;
        return unit === 'px' || unit === undefined ? n <= maxPx : n * 16 <= maxPx;
    });

// Invariants every rule must satisfy; returns readable violations so negative fixtures can assert them.
const stylesheetViolations = css => {
    const tree = parse(css);
    if (tree === null) return ['unparseable'];
    const violations = [];
    const top = tree.nodes.filter(node => node.type !== 'comment');
    if (top.length !== 1 || top[0].type !== 'atrule' || top[0].name !== 'media' || top[0].params !== 'screen') {
        violations.push('sheet must be a single @media screen block');
    }
    tree.walkAtRules(at => {
        if (!(at.name === 'media' && at.params === 'screen' && at.parent === tree)) violations.push(`unexpected @${at.name} ${at.params}`);
    });
    for (const rule of rulesOf(css)) {
        for (const selector of rule.selectors) {
            if (selector !== scope && !selector.startsWith(`${scope} `)) violations.push(`unscoped: ${selector}`);
            if (excludedHooks.test(selector.slice(scope.length))) violations.push(`excluded hook: ${selector}`);
            for (const decl of rule.decls) {
                if (!allowedProps.includes(decl.prop)) violations.push(`property: ${selector} { ${decl.prop} }`);
                if (decl.important && !importantAllowlist.includes(`${selector} { ${decl.prop} }`)) {
                    violations.push(`unexpected !important: ${selector} { ${decl.prop} }`);
                }
            }
            const props = rule.decls.map(decl => decl.prop);
            if (props.includes('color') !== props.includes('background-color')) violations.push(`unpaired paint: ${selector}`);
        }
        for (const decl of rule.decls) {
            if (/^(?:border|border-top)$/.test(decl.prop) && decl.value !== '1px solid var(--oe-wb-line)') violations.push(`border: ${decl.value}`);
            if (decl.prop === 'outline' && decl.value !== '2px solid var(--oe-wb-petrol)') violations.push(`outline: ${decl.value}`);
            if (decl.prop === 'outline-offset' && !/^[12]px$/.test(decl.value)) violations.push(`outline-offset: ${decl.value}`);
            if (/^(?:padding|padding-top|margin)$/.test(decl.prop) && !lengthsWithin(decl.value, 24)) violations.push(`${decl.prop}: ${decl.value}`);
            if (decl.prop === 'border-radius' && !lengthsWithin(decl.value, 8)) violations.push(`border-radius: ${decl.value}`);
        }
    }
    return violations;
};

const specificity = selector => {
    const bare = selector.replace(/:not\(([^)]*)\)/g, ' $1');
    const ids = (bare.match(/#[\w-]+/g) || []).length;
    const classes = (bare.match(/\.[\w-]+|:[\w-]+|\[[^\]]*\]/g) || []).length;
    const types = (bare.replace(/[#.:][\w-]+|\[[^\]]*\]/g, ' ').match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
    return ids * 1e6 + classes * 1e3 + types;
};

describe('TECH-64 personalize stylesheet', () => {
    test('the stylesheet exists and parses', () => {
        expect(readOrNull(SHEET)).not.toBeNull();
        expect(parse(sheet())).not.toBeNull();
        expect(rulesOf(sheet()).length).toBeGreaterThan(0);
    });

    test('screen only, exact workbench-context and popup scope, allowed properties, no fonts or layout', () => {
        expect(stylesheetViolations(sheet())).toEqual([]);
        expect(sheet()).not.toMatch(/@media\s+print|@import|@font-face|font-|line-height|letter-spacing|flex|display|white-space/);
    });

    test('negative fixtures: unscoped, font, flex, unpaired, excluded, print and stray !important rules are reported', () => {
        const good = `@media screen {\n  ${scope} {\n    color: var(--oe-wb-ink);\n    background-color: var(--oe-wb-canvas) !important;\n  }\n}\n`;
        expect(stylesheetViolations(good)).toEqual([]);
        const bad = [
            [good.replace(`  ${scope} {`, '  body.oe-personalize {'), 'unscoped: body.oe-personalize'],
            [good.replace(`  ${scope} {`, `  html.oe-workbench-popup body.oe-personalize {`), 'unscoped: html.oe-workbench-popup body.oe-personalize'],
            [good.replace('color: var(--oe-wb-ink);', 'color: var(--oe-wb-ink);\n    font-size: 14px;'), `property: ${scope} { font-size }`],
            [good.replace('color: var(--oe-wb-ink);', 'color: var(--oe-wb-ink);\n    display: flex;'), `property: ${scope} { display }`],
            [good.replace('    color: var(--oe-wb-ink);\n', ''), `unpaired paint: ${scope}`],
            [good.replace('color: var(--oe-wb-ink);', 'color: var(--oe-wb-ink) !important;'), `unexpected !important: ${scope} { color }`],
            [good.replace(`  ${scope} {`, `  ${scope} .text {`), `excluded hook: ${scope} .text`],
            [good.replace(`  ${scope} {`, `  ${scope} #itemdiv {`), `excluded hook: ${scope} #itemdiv`],
            [`${good}@media print {\n  ${scope} {\n    color: #000;\n    background-color: #fff;\n  }\n}\n`, 'unexpected @media print'],
            [good.replace('color: var(--oe-wb-ink);', 'color: var(--oe-wb-ink);\n    padding: 40px;'), 'padding: 40px'],
            [good.replace('color: var(--oe-wb-ink);', 'color: var(--oe-wb-ink);\n    border: 3px solid var(--oe-wb-line);'), 'border: 3px solid var(--oe-wb-line)'],
            [good.replace('color: var(--oe-wb-ink);', 'color: var(--oe-wb-ink);\n    outline-offset: -2px;'), 'outline-offset: -2px'],
        ];
        for (const [css, violation] of bad) expect(stylesheetViolations(css)).toContain(violation);
    });

    test('every var() reference is defined by popup.css and the paired tokens are all used', () => {
        const defined = new Set([...(readOrNull(POPUP) ?? '').matchAll(/^\s*(--oe-wb-[a-z0-9-]+)\s*:/gm)].map(m => m[1]));
        expect(defined.size).toBeGreaterThan(0);
        const referenced = new Set([...sheet().matchAll(/var\(\s*(--[\w-]+)/g)].map(m => m[1]));
        expect([...referenced].filter(token => !defined.has(token))).toEqual([]);
        for (const token of requiredTokens) expect([token, referenced.has(token)]).toEqual([token, true]);
        expect(sheet()).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    });

    test('the canvas answers the theme .body_top !important paint and is the only !important', () => {
        const theme = readOrNull(THEME) ?? '';
        const themeRule = /(?:^|\n)\.body_top,[^{]*\{([^}]*)\}/.exec(theme);
        expect(themeRule?.[1] ?? '').toMatch(/background-color:[^;]*!important/);
        const map = declarationMap(sheet());
        expect(map[scope]).toEqual({ color: 'var(--oe-wb-ink)', 'background-color': 'var(--oe-wb-canvas) !important' });
        expect(count(sheet(), '!important')).toBe(1);
        expect(specificity(scope)).toBeGreaterThan(specificity('.body_top'));
    });

    test('the form is a quiet paper document with modest border and padding', () => {
        const documentRule = declarationMap(sheet())[`${scope} .oe-personalize-document`];
        expect(documentRule).toMatchObject({
            color: 'var(--oe-wb-ink)',
            'background-color': 'var(--oe-wb-paper)',
            border: '1px solid var(--oe-wb-line)',
        });
        expect(documentRule).toHaveProperty('padding');
        expect(documentRule).toHaveProperty('border-radius');
    });

    test('form controls pair ink and paper across normal, focus and disabled states', () => {
        const map = declarationMap(sheet());
        expect(map[enabled]).toEqual({
            color: 'var(--oe-wb-ink)',
            'background-color': 'var(--oe-wb-paper)',
            'border-color': 'var(--oe-wb-line)',
        });
        expect(map[`${enabled}:focus`]).toMatchObject({
            color: 'var(--oe-wb-ink)',
            'background-color': 'var(--oe-wb-paper)',
            'border-color': 'var(--oe-wb-petrol)',
        });
        expect(map[`${control}:disabled`]).toEqual({
            color: 'var(--oe-wb-disabled-ink)',
            'background-color': 'var(--oe-wb-disabled-paper)',
            'border-color': 'var(--oe-wb-line)',
        });
    });

    test('keyboard focus has an outward :focus fallback in a rule separate from :focus-visible', () => {
        const rules = rulesOf(sheet());
        const fallback = rules.filter(rule => rule.selectors.some(sel => /:focus(?!-visible)/.test(sel)));
        const visible = rules.filter(rule => rule.selectors.some(sel => sel.includes(':focus-visible')));
        expect(fallback.length).toBeGreaterThan(0);
        expect(visible.length).toBeGreaterThan(0);
        expect(fallback.filter(rule => visible.includes(rule))).toEqual([]);
        const map = declarationMap(sheet());
        for (const selector of [`${enabled}:focus`, `${enabled}:focus-visible`]) {
            expect(map[selector]).toMatchObject({ outline: '2px solid var(--oe-wb-petrol)' });
            expect(map[selector]?.['outline-offset'] ?? '').toMatch(/^[12]px$/);
        }
        // Validation and disabled states keep the theme's own cues.
        for (const rule of [...fallback, ...visible]) {
            for (const selector of rule.selectors) expect(selector.startsWith(`${enabled}:focus`)).toBe(true);
        }
    });

    test('the action row keeps its natural wrap and only gains a quiet separator', () => {
        const map = declarationMap(sheet());
        const actions = map[`${scope} .oe-personalize-actions`];
        expect(actions).toBeDefined();
        for (const prop of Object.keys(actions ?? {})) expect(['border-top', 'padding-top']).toContain(prop);
        const actionSelectors = rulesOf(sheet()).flatMap(rule => rule.selectors).filter(sel => sel.includes('.oe-personalize-actions'));
        expect(actionSelectors).toEqual([`${scope} .oe-personalize-actions`]);
    });
});
