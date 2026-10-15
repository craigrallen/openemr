/*
 * TECH-62: source contract for the Add Custom Button popup
 * (library/custom_template/add_custombutton.php) in the clinical workbench.
 *
 * Standalone source tests: reads files only, no child processes or Git. The
 * route fixture is the unmodified origin/master route; the presentation is
 * limited to the explicit edits below, so undoing them must yield the
 * fixture byte for byte. Missing files fail as expectations, not import errors.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
    count,
    parseCss,
    declarationMap,
    specificity,
    compareSpecificity,
    stylesheetViolations,
    indentationViolations,
    restore,
    apply,
    controls,
} = require('../clinical-ui/custom-button-support');

const root = path.join(__dirname, '../..');
const readOrNull = file => {
    try {
        return fs.readFileSync(path.join(root, file), 'utf8');
    } catch {
        return null;
    }
};

const ROUTE = 'library/custom_template/add_custombutton.php';
const SHEET = 'interface/clinical-workspace/custom-button-popup.css';
const HELPER = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const FIXTURE = 'tests/clinical-ui/fixtures/custom-button-original.txt';
const FIXTURE_BYTES = 9831;
// The actual theme source that gives .body_top its !important canvas paint.
const THEME = 'interface/themes/color_base.scss';

const scope = 'html.oe-workbench-context.oe-workbench-popup body.oe-custom-button';
const tokens = [
    '--oe-wb-ink', '--oe-wb-muted', '--oe-wb-line', '--oe-wb-paper', '--oe-wb-canvas', '--oe-wb-petrol',
    '--oe-wb-on-petrol', '--oe-wb-disabled-ink', '--oe-wb-disabled-paper', '--oe-wb-warning-ink', '--oe-wb-warning-paper',
];

// Every edit is [original, planned]. Only imports, one screen-only link and classes are added.
const edits = [
    [
        'use OpenEMR\\Common\\Session\\SessionWrapperFactory;\nuse OpenEMR\\Core\\Header;\n',
        'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Session\\SessionWrapperFactory;\nuse OpenEMR\\Core\\Header;\nuse OpenEMR\\Core\\OEGlobalsBag;\n',
    ],
    [
        "    <?php Header::setupHeader('opener'); ?>\n",
        "    <?php Header::setupHeader('opener'); ?>\n"
            + '    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n'
            + '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/custom-button-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'custom-button-popup.css\')); ?>">\n',
    ],
    ['<body class="body_top">', '<body class="body_top oe-custom-button">'],
    [
        '<form name="designation_managment" action="" method="post" onsubmit="top.restoreSession();">',
        '<form name="designation_managment" action="" method="post" onsubmit="top.restoreSession();" class="oe-custom-button-document">',
    ],
    ['            <td class="text-center" colspan="5">', '            <td class="text-center oe-custom-button-actions" colspan="5">'],
];

const fixture = () => readOrNull(FIXTURE);
const route = () => readOrNull(ROUTE);
const sheet = () => readOrNull(SHEET);

describe('TECH-62 route fixture', () => {
    test('the original route fixture is present and unchanged in size', () => {
        const original = fixture();
        expect(original).not.toBeNull();
        expect(Buffer.byteLength(original ?? '', 'utf8')).toBe(FIXTURE_BYTES);
        for (const [before] of edits) expect(count(original ?? '', before)).toBe(1);
    });
});

describe('TECH-62 route presentation edits', () => {
    test('every planned edit appears exactly once in the route', () => {
        const php = route() ?? '';
        for (const [, planned] of edits) expect(count(php, planned)).toBe(1);
    });

    test('undoing the planned edits restores the original route byte for byte', () => {
        expect(restore(route() ?? '', edits)).toBe(fixture());
    });

    test('applying the planned edits to the original yields the route byte for byte', () => {
        expect(apply(fixture() ?? '', edits)).toBe(route());
    });

    test('every form control keeps its name, type, value, readonly, inline style, id and handlers', () => {
        expect(controls(route() ?? '')).toEqual(controls(fixture() ?? ''));
    });

    test('body keeps body_top, form and action cell gain their classes, wrapper is untouched', () => {
        const php = route() ?? '';
        expect(php).toContain('<body class="body_top oe-custom-button">');
        expect(count(php, '<body')).toBe(1);
        expect(php).toContain('class="oe-custom-button-document"');
        expect(php).toContain('<td class="text-center oe-custom-button-actions" colspan="5">');
        expect(php).toContain('<tr class="text">');
        expect(php).toContain('  <div class="table-responsive">\n    <table class="table table-borderless">');
        // The original inline paint on the read-only number cells stays in the markup.
        expect(count(php, 'readonly="" style="width:25px; background-color:#C9C9C9"')).toBe(1);
        expect(count(php, 'readonly="" style="width:50px; background-color:#C9C9C9"')).toBe(3);
    });

    test('the sheet is linked once, screen only, versioned through the asset helper and typed webroot', () => {
        const php = route() ?? '';
        expect(count(php, 'custom-button-popup.css')).toBe(2);
        expect(php).toContain('use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;');
        expect(php).not.toMatch(/Utils\\Layouts|Common\\Utils\\.*ClinicalWorkspaceAssets/);
        expect(php).toContain('use OpenEMR\\Core\\OEGlobalsBag;');
        expect(php).toMatch(/<link rel="stylesheet" media="screen" href="<\?php echo attr\(OEGlobalsBag::getInstance\(\)->getWebRoot\(\)\); \?>\/interface\/clinical-workspace\/custom-button-popup\.css\?v=<\?php echo attr_url\(\$clinicalAssets->version\('custom-button-popup\.css'\)\); \?>">/);
        expect(php).not.toMatch(/\$GLOBALS\['webroot'\]|getString\('webroot'\)/);
    });
});

describe('TECH-62 negative controls', () => {
    // Each mutation is applied to the original fixture plus the planned edits.
    const mutations = [
        ["name='form_save' id='form_save'", "name='form_store' id='form_save'"],
        ["name='form_delete' id='form_delete'", "name='form_delete' id='form_remove'"],
        ["<input type='submit' class=\"btn btn-primary\"", "<input type='button' class=\"btn btn-primary\""],
        ['onsubmit="top.restoreSession();"', 'onsubmit=""'],
        ['method="post"', 'method="get"'],
        ['readonly="" style="width:25px; background-color:#C9C9C9"', 'style="width:25px; background-color:#C9C9C9"'],
        ['readonly="" style="width:50px; background-color:#C9C9C9" /></td>\n            <td><input type=\'text\' class="form-control" name="<?php echo htmlspecialchars(\'inshort\' . $i,', 'readonly="" style="width:50px" /></td>\n            <td><input type=\'text\' class="form-control" name="<?php echo htmlspecialchars(\'inshort\' . $i,'],
        ['<input type="hidden" name="count" value="<?php echo htmlspecialchars(($i + 2), ENT_QUOTES); ?>" />', ''],
        ["<input type='checkbox' name='<?php echo htmlspecialchars(\"chk\" . $i, ENT_QUOTES); ?>'", "<input type='checkbox' name='<?php echo htmlspecialchars(\"check\" . $i, ENT_QUOTES); ?>'"],
        ['  <div class="table-responsive">\n', '  <div>\n'],
        ['<tr class="text">', '<tr class="text oe-custom-button-row">'],
        ['    $end = $st + $count;\n', '    $end = $sta + $count;\n'],
        ["        .class1 {\n            background-color: #7dc1db;\n        }\n", ''],
        ['ORDER BY cl.cl_order", [$authUserID]);', 'ORDER BY cl.cl_order DESC", [$authUserID]);'],
    ];

    test.each(mutations)('mutation %# breaks restoration', (from, to) => {
        const original = fixture() ?? '';
        expect(count(original, from)).toBe(1);
        const planned = apply(original, edits);
        expect(planned).not.toBeNull();
        const mutated = (planned ?? '').replace(from, () => to);
        expect(restore(mutated, edits)).not.toBe(original);
    });

    test('a stray class or extra link outside the declared edits breaks restoration', () => {
        const original = fixture() ?? '';
        const planned = apply(original, edits) ?? '';
        expect(restore(planned.replace('<h3 class="text-center">', '<h3 class="text-center oe-extra">'), edits)).not.toBe(original);
        expect(restore(planned.replace('</head>', '<link rel="stylesheet" href="x.css">\n</head>'), edits)).not.toBe(original);
        expect(restore(planned.replace('oe-custom-button-actions', 'oe-custom-button-action'), edits)).toBeNull();
    });
});

describe('TECH-62 asset helper allowlist', () => {
    test('ClinicalWorkspaceAssets registers custom-button-popup.css in sorted order', () => {
        const helper = readOrNull(HELPER) ?? '';
        expect(helper).toContain('namespace OpenEMR\\Common\\Assets;');
        const list = [...(/private const SUPPORTED = \[([\s\S]*?)\];/.exec(helper)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(m => m[1]);
        expect(list).toContain('custom-button-popup.css');
        expect(list).toEqual([...list].sort());
    });
});

describe('TECH-62 route stylesheet', () => {
    const actions = `${scope} .oe-custom-button-actions`;
    // The theme paints .body_top background-color !important, so the canvas must answer in kind.
    const importantAllowlist = [[scope, 'background-color']];
    // The action cell may wrap its existing buttons; every other layout change is refused.
    const allowedLayout = new Set([
        `layout/overflow change: ${actions} { display }`,
        `layout/overflow change: ${actions} { flex-wrap }`,
    ]);

    test('the stylesheet exists', () => {
        expect(sheet()).not.toBeNull();
    });

    test('the stylesheet satisfies the popup invariants', () => {
        const violations = stylesheetViolations(sheet() ?? '', { scope, importantAllowlist, tokens })
            .filter(violation => !allowedLayout.has(violation));
        expect(violations).toEqual([]);
        expect(indentationViolations(sheet() ?? '')).toEqual([]);
    });

    test('the canvas background-color is the only !important declaration', () => {
        const important = parseCss(sheet() ?? '').rules.flatMap(rule => rule.decls
            .filter(decl => decl.important)
            .flatMap(decl => rule.selectors.map(selector => [selector, decl.prop])));
        expect(important).toEqual(importantAllowlist);
        expect(count(sheet() ?? '', '!important')).toBe(1);
    });

    test('negative mutation: any other !important declaration is reported', () => {
        const css = `@media screen {\n  ${scope} {\n    color: var(--oe-wb-ink);\n    background-color: var(--oe-wb-canvas) !important;\n  }\n}\n`;
        const check = source => stylesheetViolations(source, { scope, importantAllowlist, tokens });
        expect(check(css)).toEqual([]);
        expect(check(css.replace('color: var(--oe-wb-ink);', 'color: var(--oe-wb-ink) !important;')))
            .toContain(`unexpected !important: ${scope} { color }`);
        expect(check(css.replace('{\n    color', `{\n    border-color: var(--oe-wb-line) !important;\n    color`)))
            .toContain(`unexpected !important: ${scope} { border-color }`);
        expect(check(css.replace(`  ${scope} {`, `  ${scope} .form-control {\n    background-color: var(--oe-wb-paper) !important;\n    color: var(--oe-wb-ink);\n  }\n  ${scope} {`)))
            .toContain(`unexpected !important: ${scope} .form-control { background-color }`);
    });

    test('the actual theme .body_top canvas paint is !important and the scoped rule outranks it', () => {
        const theme = readOrNull(THEME) ?? '';
        const themeRule = /(?:^|\n)\.body_top,[^{]*\{([^}]*)\}/.exec(theme);
        expect(themeRule).not.toBeNull();
        expect(themeRule?.[1] ?? '').toMatch(/background-color:[^;]*!important/);
        const canvas = declarationMap(parseCss(sheet() ?? ''))[scope]?.['background-color'];
        expect(canvas).toBe('var(--oe-wb-canvas) !important');
        expect(compareSpecificity(specificity(scope), specificity('.body_top'))).toBeGreaterThan(0);
    });

    test('table, title_bar_top and class1 each repaint ink and paper as a pair', () => {
        const rules = parseCss(sheet() ?? '').rules;
        const hooks = {
            table: /(?:^|\s)(?:table|\.table)(?![\w-])/,
            title_bar_top: /\.title_bar_top(?![\w-])/,
            class1: /\.class1(?![\w-])/,
        };
        for (const [name, pattern] of Object.entries(hooks)) {
            const paired = rules.filter(rule => rule.selectors.some(sel => pattern.test(sel))
                && rule.decls.some(decl => decl.prop === 'color')
                && rule.decls.some(decl => decl.prop === 'background-color'));
            expect([name, paired.length > 0]).toEqual([name, true]);
        }
    });

    test('editable fields get a :focus fallback and a separate :focus-visible ring, native states excluded', () => {
        const rules = parseCss(sheet() ?? '').rules;
        const fallback = rules.filter(rule => rule.selectors.some(sel => /:focus(?!-visible)/.test(sel)));
        const visible = rules.filter(rule => rule.selectors.some(sel => sel.includes(':focus-visible')));
        expect(fallback.length).toBeGreaterThan(0);
        expect(visible.length).toBeGreaterThan(0);
        expect(fallback.filter(rule => visible.includes(rule))).toEqual([]);
        const excluded = ['.was-validated', ':disabled', '.is-invalid', '.is-valid', '[readonly]'];
        for (const rule of [...fallback, ...visible]) {
            expect(rule.decls.some(decl => /^outline/.test(decl.prop))).toBe(true);
            for (const selector of rule.selectors) {
                expect(selector).toContain('.form-control');
                const negated = [...selector.matchAll(/:not\(([^)]*)\)/g)].map(m => m[1]).join(' ');
                for (const state of excluded) expect([state, negated.includes(state)]).toEqual([state, true]);
                expect(selector.replace(/:not\([^)]*\)/g, '')).not.toMatch(/\.was-validated|:disabled|\.is-(?:in)?valid|\[readonly\]/);
            }
        }
    });

    test('the document, field and action hooks are styled', () => {
        const parsed = parseCss(sheet() ?? '');
        const map = declarationMap(parsed);
        expect(map[scope]).toBeDefined();
        expect(map[`${scope} .oe-custom-button-document`]).toBeDefined();
        expect(map[actions]).toMatchObject({ display: 'flex', 'flex-wrap': 'wrap' });
        const selectors = parsed.rules.flatMap(rule => rule.selectors);
        expect(selectors.some(sel => sel.includes('.oe-custom-button-document') && sel.includes('.form-control'))).toBe(true);
    });

    test('field repaint excludes readonly cells so their inline paint stays visible', () => {
        const parsed = parseCss(sheet() ?? '');
        const paint = new Set(['color', 'background-color', 'border-color']);
        const repaints = parsed.rules.filter(rule => rule.decls.some(decl => paint.has(decl.prop)));
        for (const rule of repaints) {
            for (const selector of rule.selectors) {
                if (/\.form-control|input/.test(selector)) expect(selector).toMatch(/:not\([^)]*\[readonly\]/);
                // Never select readonly positively or key off the inline style attribute.
                expect(selector.replace(/:not\([^)]*\)/g, '')).not.toMatch(/\[readonly\]|\[style/);
            }
        }
    });

    test('the sheet does not touch the table-responsive wrapper or the theme .text row', () => {
        const selectors = parseCss(sheet() ?? '').rules.flatMap(rule => rule.selectors);
        expect(selectors.filter(sel => /\.table-responsive|(?:^|\s)\.text(?:[\s.:[]|$)/.test(sel))).toEqual([]);
    });
});
