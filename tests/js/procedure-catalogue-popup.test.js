/** @jest-environment node */

/*
 * Procedure catalogue (interface/orders/types.php) as a screen-only workbench document sheet.
 *
 * Scope: html.oe-workbench-context, not the popup marker. The route renders the same document
 * as the dlgopen picker from orders_results.php (a .dialogModal frame, so popup.js also sets the
 * popup marker) and as the admin/super maintenance tab from the menu (context only). Only
 * presentation changes, so both modes get the sheet while their ACL gates, controls, AJAX tree,
 * SQL, selection, opener and QOE callbacks stay byte-identical (proved by the inverse map below).
 *
 * These are source checks. They do not establish native geometry, rendered contrast, keyboard
 * reachability or print output; those need separate browser acceptance.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
// Production files that do not exist yet read as empty so RED is an assertion failure.
const readOptional = file => (fs.existsSync(path.join(root, file)) ? read(file) : '');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const count = (value, part) => value.split(part).length - 1;

const ROUTE = 'interface/orders/types.php';
const SHEET = 'interface/clinical-workspace/procedure-catalogue-popup.css';
const SCOPE = 'html.oe-workbench-context body.oe-procedure-catalogue';
const source = () => read(ROUTE);
const css = () => readOptional(SHEET);

const baselineHash = '202c4e2762658bbc2e7d497a420cab8d993727ca88e3f0e6d729b7628755f03c';
const baselineLines = 407;

// Each entry is [original, presentation addition]; the addition only inserts characters.
const presentationChanges = [
    ['use OpenEMR\\Common\\Acl\\AclMain;', 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;'],
    [
        "    <?php Header::setupHeader(['opener', 'datetime-picker']);?>",
        "    <?php Header::setupHeader(['opener', 'datetime-picker']);?>\n"
            + '    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n'
            + '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/procedure-catalogue-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'procedure-catalogue-popup.css\')); ?>">',
    ],
    ['<body>', '<body class="oe-procedure-catalogue">'],
    ['<div class="container mt-3">', '<div class="container mt-3 oe-catalogue-sheet">'],
];

function isPureInsertion(before, after) {
    let prefix = 0;
    while (prefix < before.length && before[prefix] === after[prefix]) prefix++;
    let suffix = 0;
    while (suffix < before.length - prefix
        && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
    return after.length > before.length && prefix + suffix === before.length;
}

function restorePresentation(php) {
    let restored = php;
    const missing = [];
    for (const [before, after] of presentationChanges) {
        if (count(restored, after) !== 1) {
            missing.push(after);
            continue;
        }
        restored = restored.replace(after, before);
    }
    return { restored, missing };
}

function cssRules(text = css()) {
    const rules = [];
    postcss.parse(text).walkRules(rule => {
        const declarations = {};
        rule.walkDecls(decl => { declarations[decl.prop] = decl.value; });
        rules.push({ selectors: rule.selectors, declarations, important: rule.some(node => node.important) });
    });
    return rules;
}

// Every !important declaration as {selector, prop}, one entry per selector of its rule.
function importantDeclarations(text = css()) {
    const found = [];
    postcss.parse(text).walkDecls(decl => {
        if (!decl.important) return;
        for (const selector of decl.parent.selectors) found.push({ selector, prop: decl.prop });
    });
    return found;
}

const ruleFor =(rules, predicate) => rules.filter(rule => rule.selectors.some(predicate));

// style_dark/style_solar compile Bootstrap's `.text-body { color: $body-color !important }` to
// near-white, and types_ajax.php puts it on the tree's edit/add icons. On the paper rows that
// would be white-on-paper, so this one selector is the only permitted !important repaint.
const THEME_INK_EXCEPTION = `${SCOPE} #con0 .text-body`;

describe('route source stays the original document plus presentation hooks', () => {
    test('the addition map is pure insertion and each addition appears exactly once', () => {
        for (const [before, after] of presentationChanges) {
            expect(isPureInsertion(before, after)).toBe(true);
        }
        const php = source();
        expect(presentationChanges.map(([, after]) => count(php, after))).toEqual(presentationChanges.map(() => 1));
    });

    test('inverting only the addition map restores the exact original route', () => {
        const { restored, missing } = restorePresentation(source());
        expect(missing).toEqual([]);
        expect(restored.split('\n').length - 1).toBe(baselineLines);
        expect(sha256(restored)).toBe(baselineHash);
    });

    test('the invariant rejects SQL, ACL, QOE, opener, AJAX, control, stripe and font mutations', () => {
        const { restored } = restorePresentation(source());
        const mutations = [
            ['SELECT name FROM procedure_type WHERE procedure_type_id = ?', 'SELECT * FROM procedure_type WHERE procedure_type_id = ?'],
            ['SELECT parent FROM procedure_type WHERE procedure_type_id = ?', 'SELECT parent FROM procedure_type WHERE parent = ?'],
            ["if (!$popup && !AclMain::aclCheckCore('admin', 'super'))", "if (!$popup && !AclMain::aclCheckCore('patients', 'lab'))"],
            ["!AclMain::aclCheckCore('patients', 'lab') && !AclMain::aclCheckCore('admin', 'super')", "!AclMain::aclCheckCore('patients', 'lab')"],
            ["generate_qoe_html($form_order, (int)$_GET['formid'], 0, (int)$_GET['formseq'])", "generate_qoe_html($form_order, 0, 0, 0)"],
            ['opener.set_proc_type(', 'opener.set_proc_name('],
            ["echo ' opener.set_proc_html(\"';", "echo ' opener.set_html(\"';"],
            ['window.close(); // comment out for debugging', '// window.close();'],
            ["$.getScript('types_ajax.php?id=' + encodeURIComponent(id)", "$.getScript('types_ajax2.php?id=' + encodeURIComponent(id)"],
            ["name='form_save'", "name='form_submit'"],
            ['onclick="refreshme()"', 'onclick="location.reload()"'],
            ['onclick="CancelDistribute()"', 'onclick="window.close()"'],
            ["onclick='handleNode(0,\"\",true,\"\")'", "onclick='handleNode(0,\"\",false,\"\")'"],
            ['this.className = (i++ & 1) ? "evenrow" : "oddrow";', 'this.className = "oddrow";'],
            ['font-size: 16px;\n            line-height: 25px;', 'font-size: 14px;\n            line-height: 25px;'],
            ['font-family: sans-serif;', 'font-family: serif;'],
        ];
        for (const [before, after] of mutations) {
            expect(restored).toContain(before);
            expect(sha256(restored.replace(before, after))).not.toBe(baselineHash);
        }
    });

    test('the AJAX painter, the popup caller and the shared activation stay byte-identical', () => {
        expect(sha256(read('interface/orders/types_ajax.php'))).toBe('a47773ce02cf891820520e6df00f327bccc11f48d4741232669995fd522e464e');
        expect(sha256(read('interface/orders/orders_results.php'))).toBe('25748690ecc6d88a24925101be00a8615ecc2b4699a43e618ad377f11156e00c');
        expect(sha256(read('interface/clinical-workspace/popup.js'))).toBe('af967e78fef59e75d2a5a5c4e08916bbea90a7f108c67f3def027b3061dc330f');
        expect(sha256(read('interface/clinical-workspace/popup.css'))).toBe('ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9');
        expect(read('interface/orders/orders_results.php')).toContain("dlgopen('types.php?' + params, '_blank', 800, 500);");
    });

    test('every original action, tooltip and tree hook is still rendered in both modes', () => {
        const php = source();
        for (const action of [
            "onclick='handleNode(0,\"\",true,\"\")'",
            'onclick="refreshme()"',
            "name='form_save'",
            'onclick="CancelDistribute()"',
            '<?php if ($popup) { ?>',
            'id="help-href"',
            'name-tooltip', 'order-tooltip', 'code-tooltip', 'tier-tooltip',
            '<div class="table-responsive">',
            '<table class="table mb-0">',
            '<div id="con0"></div>',
            "action='types.php?popup=<?php echo attr_url($popup); ?>",
        ]) {
            expect(php).toContain(action);
        }
        // Hooks are attributes only: no new elements, scripts, fonts or behaviour.
        expect(count(php, '<script')).toBe(count(restorePresentation(php).restored, '<script'));
        expect(count(php, '<link ')).toBe(1);
    });
});

describe('screen-only, helper-versioned route stylesheet', () => {
    test('the sheet is linked once with media="screen" right after the Header assets', () => {
        const php = source();
        const link = '<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/procedure-catalogue-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'procedure-catalogue-popup.css\')); ?>">';
        expect(count(php, link)).toBe(1);
        const header = php.indexOf("Header::setupHeader(['opener', 'datetime-picker']);?>");
        expect(header).toBeGreaterThan(-1);
        expect(php.indexOf(link)).toBeGreaterThan(header);
        expect(php.indexOf(link)).toBeLessThan(php.indexOf('<title>'));
    });

    test('the asset helper versions the sheet', () => {
        expect(read('src/Common/Assets/ClinicalWorkspaceAssets.php')).toMatch(/^\s*'procedure-catalogue-popup\.css',$/m);
    });

    test('the sheet is one screen block with no breakpoints, print rules, imports or fonts', () => {
        const text = css();
        const tree = postcss.parse(text);
        const media = [];
        tree.walkAtRules(rule => media.push(`${rule.name} ${rule.params}`));
        expect(media).toEqual(['media screen']);
        expect(tree.nodes.filter(node => node.type !== 'comment').map(node => node.type)).toEqual(['atrule']);
        expect(text).not.toMatch(/@import|@font-face|url\(/);
    });

    test('every selector is scoped to the workbench context and the route body class', () => {
        const rules = cssRules();
        expect(rules.length).toBeGreaterThan(0);
        for (const rule of rules) {
            for (const selector of rule.selectors) {
                expect(selector.startsWith(`${SCOPE} `) || selector === SCOPE).toBe(true);
            }
        }
        expect(read('interface/clinical-workspace/popup.js')).toContain("const CONTEXT_CLASS = 'oe-workbench-context';");
    });

    test('the header comment documents the scope choice and inherited contrast limits', () => {
        const comment = (css().match(/^\s*\/\*([\s\S]*?)\*\//) || ['', ''])[1];
        for (const term of ['oe-workbench-context', 'maintenance', 'yellow', 'pink', 'contrast']) {
            expect(comment).toContain(term);
        }
    });
});

describe('document sheet presentation', () => {
    test('original fonts, sizes and line heights are untouched; only #con0 .text-body color is !important', () => {
        for (const rule of cssRules()) {
            for (const prop of ['font', 'font-family', 'font-size', 'font-weight', 'line-height', 'text-transform']) {
                expect(rule.declarations).not.toHaveProperty(prop);
            }
        }
        expect(importantDeclarations()).toEqual([{ selector: THEME_INK_EXCEPTION, prop: 'color' }]);
    });

    test('the !important checker rejects extra declarations, selectors and rules', () => {
        const base = `@media screen { ${THEME_INK_EXCEPTION} { color: var(--oe-wb-ink) !important; background-color: transparent; } }`;
        const allowed = [{ selector: THEME_INK_EXCEPTION, prop: 'color' }];
        expect(importantDeclarations(base)).toEqual(allowed);
        const mutations = [
            base.replace('background-color: transparent;', 'background-color: transparent !important;'),
            base.replace(`${THEME_INK_EXCEPTION} {`, `${THEME_INK_EXCEPTION}, ${SCOPE} .table {`),
            `${base.slice(0, -1)} ${SCOPE} .table { color: var(--oe-wb-ink) !important; } }`,
        ];
        for (const mutated of mutations) {
            expect(importantDeclarations(mutated)).not.toEqual(allowed);
        }
    });

    test('no original node is hidden, clipped or height-capped', () => {
        for (const rule of cssRules()) {
            const d = rule.declarations;
            expect(d.display).not.toBe('none');
            expect(d.visibility ?? 'visible').toBe('visible');
            expect(d.opacity ?? '1').not.toMatch(/^0(\.0*)?$/);
            for (const prop of ['overflow', 'overflow-x', 'overflow-y']) {
                expect(d[prop] ?? 'visible').not.toMatch(/hidden|clip/);
            }
            for (const prop of ['height', 'max-height', 'clip', 'clip-path', 'content-visibility']) {
                expect(d).not.toHaveProperty(prop);
            }
            expect(d.position ?? 'static').not.toMatch(/fixed|sticky|absolute/);
        }
    });

    test('the original container becomes a paired paper sheet with Bootstrap gutters reconciled', () => {
        const rules = cssRules();
        const sheet = ruleFor(rules, s => s === `${SCOPE} .oe-catalogue-sheet`);
        expect(sheet).toHaveLength(1);
        expect(sheet[0].declarations).toMatchObject({
            color: 'var(--oe-wb-ink)',
            background: 'var(--oe-wb-paper)',
        });
        expect(sheet[0].declarations).toHaveProperty('border');
        expect(sheet[0].declarations.padding).toBe('12px 16px');

        const px = value => Number.parseFloat(String(value));
        const row = ruleFor(rules, s => s === `${SCOPE} .oe-catalogue-sheet > .row`)[0]?.declarations ?? {};
        const col = ruleFor(rules, s => s === `${SCOPE} .oe-catalogue-sheet > .row > .col-sm-12`)[0]?.declarations ?? {};
        expect(row).toHaveProperty('margin-left');
        expect(row).toHaveProperty('margin-right');
        expect(px(row['margin-left'])).toBe(-px(col['padding-left']));
        expect(px(row['margin-right'])).toBe(-px(col['padding-right']));
    });

    test('the header table keeps its table-responsive wrapper and the tree scrolls with the document', () => {
        for (const rule of cssRules()) {
            for (const selector of rule.selectors) {
                if (/\.table-responsive$/.test(selector)) {
                    expect(rule.declarations).not.toHaveProperty('overflow');
                    expect(rule.declarations).not.toHaveProperty('overflow-x');
                    expect(rule.declarations).not.toHaveProperty('display');
                }
                if (/#con0$/.test(selector)) {
                    // The viewport stays the only scroller: no inner, unfocusable scroll region.
                    for (const prop of ['overflow', 'overflow-x', 'overflow-y', 'width', 'max-width']) {
                        expect(rule.declarations).not.toHaveProperty(prop);
                    }
                }
            }
        }
    });

    test('theme .table, header, stripe and cell paint is repainted in ink/paper pairs', () => {
        const rules = cssRules();
        for (const target of [/ \.table$/, /tr\.head$/, /#con0 tr\.evenrow$/, /#con0 tr\.oddrow$/]) {
            const matching = ruleFor(rules, s => target.test(s));
            expect(matching.length).toBeGreaterThan(0);
            for (const rule of matching) {
                expect(rule.declarations).toHaveProperty('color');
                expect(rule.declarations.background ?? rule.declarations['background-color']).toBeDefined();
            }
        }
        const cells = ruleFor(rules, s => /#con0 td$/.test(s));
        expect(cells.length).toBeGreaterThan(0);
        expect(cells.every(rule => rule.declarations['background-color'] === 'transparent')).toBe(true);
    });

    test('every repaint pairs colour with background and uses workbench tokens', () => {
        const token = /^(var\(--oe-wb-[a-z-]+\)|transparent)$/;
        for (const rule of cssRules()) {
            const d = rule.declarations;
            const background = d.background ?? d['background-color'];
            const paints = background !== undefined && background !== 'transparent';
            if (paints) expect(d).toHaveProperty('color');
            if (d.color !== undefined) expect(background).toBeDefined();
            for (const value of [d.color, background].filter(v => v !== undefined)) {
                expect(value).toMatch(token);
            }
        }
    });

    test('inline yellow/pink clinical marks and tree link colours are not overridden', () => {
        for (const rule of cssRules()) {
            for (const selector of rule.selectors) {
                if (selector === THEME_INK_EXCEPTION) continue;
                expect(selector).not.toMatch(/mark|oe-patient-background|oe-pink-background|text-danger|required-tooltip|text-body|\.fa\b|\.plusminus|\.oe-(grp|ord|bold)/);
                if (/\.haskids|#con0 td$|#con0 \*|\btd \*$|span$/.test(selector)) {
                    expect(rule.declarations).not.toHaveProperty('color');
                }
            }
        }
    });

    test('dark-theme icon ink that would vanish on the paper sheet is paired with workbench ink', () => {
        // Theme sources: oe-styles/style_dark.scss and style_solar.scss swap $black/$white and set
        // $body-color near-white; help-files-common.scss gives .oe-text-black `color: $black`.
        expect(read('interface/orders/types_ajax.php')).toContain('class=\\"text-body haskids fa fa-pencil-alt fa-lg\\"');
        expect(read('interface/themes/oe-common/help-files-common.scss')).toMatch(/\.oe-text-black \{\s*color: \$black;/);
        const rules = cssRules();
        const body = ruleFor(rules, s => s === THEME_INK_EXCEPTION);
        expect(body).toHaveLength(1);
        expect(body[0].selectors).toEqual([THEME_INK_EXCEPTION]);
        expect(body[0].declarations).toEqual({ color: 'var(--oe-wb-ink)', 'background-color': 'transparent' });
        expect(postcss.parse(css()).toString()).toMatch(/#con0 \.text-body \{\s*color: var\(--oe-wb-ink\) !important;/);
        const black = ruleFor(rules, s => s === `${SCOPE} tr.head .oe-text-black`);
        expect(black).toHaveLength(1);
        expect(black[0].declarations).toEqual({ color: 'var(--oe-wb-ink)', 'background-color': 'transparent' });
    });

    test('original button groups wrap instead of overflowing', () => {
        const groups = ruleFor(cssRules(), s => /\.btn-group$/.test(s));
        expect(groups.length).toBeGreaterThan(0);
        expect(groups.some(rule => rule.declarations['flex-wrap'] === 'wrap')).toBe(true);
    });

    test('focus has separate homogeneous :focus fallback and :focus-visible rules', () => {
        const rules = cssRules();
        const focusRules = rules.filter(rule => rule.selectors.some(s => /:focus/.test(s)));
        expect(focusRules.length).toBeGreaterThan(0);
        for (const rule of focusRules) {
            const kinds = new Set(rule.selectors.map(s => (/:focus-visible$/.test(s) ? 'visible' : /:focus$/.test(s) ? 'focus' : 'other')));
            expect([...kinds]).toHaveLength(1);
            expect(kinds.has('other')).toBe(false);
            expect(rule.declarations.outline).toMatch(/^\d+px solid var\(--oe-wb-petrol\)$/);
        }
        const bases = kind => new Set(focusRules
            .flatMap(rule => rule.selectors)
            .filter(s => (kind === 'visible' ? /:focus-visible$/.test(s) : /:focus$/.test(s)))
            .map(s => s.replace(/:focus(-visible)?$/, '')));
        const fallback = bases('focus');
        const visible = bases('visible');
        expect(fallback.size).toBeGreaterThan(0);
        expect([...fallback].sort()).toEqual([...visible].sort());
        expect([...fallback].some(s => /\.btn$/.test(s))).toBe(true);
        expect([...fallback].some(s => /input\[type='radio'\]$/.test(s))).toBe(true);
    });
});
