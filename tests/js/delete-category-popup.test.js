/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
// The sheet lands with the implementation; until then it reads as empty so the
// assertions below, not module loading, report what is missing.
const optional = file => (fs.existsSync(path.join(root, file)) ? read(file) : '');
const source = () => read('library/custom_template/delete_category.php');
const original = () => read('tests/clinical-ui/fixtures/delete-category-original.txt');
const css = () => optional('interface/clinical-workspace/delete-category-popup.css');
const popupCss = () => read('interface/clinical-workspace/popup.css');

const scope = 'html.oe-workbench-context.oe-workbench-popup body.body_top.oe-delete-category';
const form = `${scope} form.oe-delete-category-form`;
const count = (text, part) => text.split(part).length - 1;

const sheetLink = '        <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/delete-category-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'delete-category-popup.css\')); ?>">\n';

// Every edit is [original, presented]. These four are the whole presentation diff.
const changes = [
    ['\nuse OpenEMR\\Core\\Header;\n', '\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Core\\Header;\n'],
    ["        <?php Header::setupHeader('opener'); ?>\n", "        <?php Header::setupHeader('opener'); ?>\n        <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n" + sheetLink],
    ['    <body class="body_top">\n', '    <body class="body_top oe-delete-category">\n'],
    ['    <form name="myform">\n', '    <form name="myform" class="oe-delete-category-form">\n'],
];

// Apply the declared edits to the original route.
const present = text => {
    let presented = text;
    for (const [before, after] of changes) {
        if (count(presented, before) !== 1) throw new Error(`Expected one original anchor: ${before}`);
        presented = presented.replace(before, () => after);
    }
    return presented;
};

// Undo the declared edits; returns null when any edit is missing or ambiguous.
const restore = text => {
    let restored = text;
    for (const [before, after] of changes) {
        if (count(restored, after) !== 1) return null;
        restored = restored.replace(after, () => before);
    }
    return restored;
};

test('the fixture is the 119-line original route with no presentation hooks', () => {
    const fixture = original();
    expect(fixture.split('\n').length - 1).toBe(119);
    expect(fixture.endsWith('    echo "</table>";\n    ?>\n')).toBe(true);
    expect(fixture).not.toMatch(/oe-delete-category|ClinicalWorkspaceAssets|delete-category-popup/);
    for (const [before] of changes) expect(count(fixture, before)).toBe(1);
});

test('the route is the original plus exactly the four declared presentation edits', () => {
    const php = source();
    for (const [, after] of changes) expect(count(php, after)).toBe(1);
    expect(restore(php)).toBe(original());
    expect(php).toBe(present(original()));
});

test('negative controls: behaviour, escaping and markup mutations break restoration', () => {
    const presented = present(original());
    expect(restore(presented)).toBe(original());
    const mutations = [
        // Confirmation before any request.
        ["            if(confirm(<?php echo xlj('Do you want to delete?'); ?>)){\n", '            if(true){\n'],
        // Shared-user guard: other users block deletion, otherwise fall through to the full delete.
        ['                            if(thedata){\n', '                            if(false){\n'],
        ['                                delete_full_category(id);\n', ''],
        // Deletion callbacks and their endpoint sources.
        ['source: "delete_full_category"', 'source: "delete_category"'],
        ['source: "delete_category"', 'source: "delete_full_category"'],
        ["                            alert(<?php echo xlj('Deleted Successfully.'); ?>);\n", ''],
        ['                            document.location.reload();\n', ''],
        // Both session restores, anchored by their enclosing function.
        ['        function delete_full_category(id){\n                top.restoreSession();\n', '        function delete_full_category(id){\n'],
        ['        function delete_category(id){\n            top.restoreSession();\n', '        function delete_category(id){\n'],
        // Queries.
        ['WHERE cl_list_type=3 AND cl_deleted=0"', 'WHERE cl_list_type=3"'],
        ['"SELECT * FROM customlists WHERE cl_list_slno=?"', '"SELECT * FROM customlists WHERE cl_list_id=?"'],
        // Output escaping.
        ["htmlspecialchars((string) $row['cl_list_item_long'], ENT_QUOTES)", "$row['cl_list_item_long']"],
        ["htmlspecialchars((string) $context['cl_list_item_long'], ENT_QUOTES)", "$context['cl_list_item_long']"],
        ["htmlspecialchars((string) $row['cl_list_slno'], ENT_QUOTES)", "$row['cl_list_slno']"],
        ['htmlspecialchars($class, ENT_QUOTES)', '$class'],
        // The image Delete control, its link and the table.
        ["onclick=delete_category('", "onclick=delete_full_category('"],
        ["border=0 title='Delete This Row'", "border=0 alt='' title='Delete This Row'"],
        ['        echo "<td><a href=#>";\n', '        echo "<td><a href=# class=\'btn\'>";\n'],
        ['<table align="center">', '<table align="center" class="w-100">'],
        ["'reportTableEvenRow' : 'reportTableOddRow'", "'reportTableOddRow' : 'reportTableEvenRow'"],
        // Header and scripts.
        ["<?php Header::setupHeader('opener'); ?>", '<?php Header::setupHeader(); ?>'],
        ['/library/js/ajax_functions_writer.js', '/library/js/ajax_functions.js'],
        // The legacy form, body and html stay unclosed.
        ['    echo "</table>";\n    ?>\n', '    echo "</table>";\n    ?>\n    </form>\n    </body>\n</html>\n'],
        // Presentation edits outside the declared shape.
        ['media="screen"', 'media="all"'],
        ['<body class="body_top oe-delete-category">', '<body class="body_top oe-delete-category" style="padding:0">'],
        ['<form name="myform" class="oe-delete-category-form">', '<form name="myform" class="oe-delete-category-form" method="post">'],
    ];
    for (const [from, to] of mutations) {
        expect(count(presented, from)).toBe(1);
        expect(restore(presented.replace(from, () => to))).not.toBe(original());
    }
});

test('the route adds no CSRF or ACL handling of its own and keeps its legacy surface', () => {
    const php = source();
    expect(php).not.toMatch(/CsrfUtils|csrf_token|aclCheckCore|AclMain/);
    expect(php).not.toMatch(/<\/form>|<\/body>|<\/html>/);
    expect(count(php, 'top.restoreSession();')).toBe(2);
    expect(count(php, 'delete-category-popup.css')).toBe(2);
    expect(php.indexOf('use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;')).toBeGreaterThan(-1);
    expect(php.indexOf('use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;')).toBeLessThan(php.indexOf('use OpenEMR\\Core\\Header;'));
    expect(php.indexOf('delete-category-popup.css')).toBeGreaterThan(php.indexOf("Header::setupHeader('opener')"));
});

test('the caller dialog and the deletion endpoint gate are unchanged', () => {
    const personalize = read('library/custom_template/personalize.php');
    expect(count(personalize, "                    if (AclMain::aclCheckCore('nationnotes', 'nn_configure')) {\n                        ?>\n                        <a href=\"delete_category.php\" id=\"share_link\" class=\"iframe_medium btn btn-primary\" onclick=\"top.restoreSession();\"><?php echo xlt('Delete Category'); ?></a>\n")).toBe(1);
    expect(count(personalize, "            $(\".iframe_medium\").on('click', function (e) {\n                e.preventDefault();\n                e.stopPropagation();\n                dlgopen('', '', 500, 500, '', '', {\n")).toBe(1);

    const ajax = read('library/custom_template/ajax_code.php');
    const gate = "    in_array($Source, ['save_provider', 'delete_category', 'delete_full_category'], true)\n    && !AclMain::aclCheckCore('nationnotes', 'nn_configure')\n) {\n    AccessDeniedHelper::denyWithTemplate(";
    const check = "} elseif ($Source == 'delete_category') {\n    $res = sqlStatement(\"SELECT * FROM template_users AS tu LEFT OUTER JOIN users AS u ON tu.tu_user_id=u.id WHERE tu_template_id=? AND tu.tu_user_id!=?\", [$templateid, $authUserID]);\n";
    const remove = "} elseif ($Source == 'delete_full_category') {\n    sqlStatement(\"UPDATE customlists SET cl_deleted=? WHERE cl_list_slno=?\", [1, $templateid]);\n";
    for (const part of [gate, check, remove]) expect(count(ajax, part)).toBe(1);
    expect(ajax.indexOf(gate)).toBeLessThan(ajax.indexOf(check));
    expect(ajax.indexOf(gate)).toBeLessThan(ajax.indexOf(remove));
});

test('the asset helper registers the sheet in sorted order', () => {
    const helper = read('src/Common/Assets/ClinicalWorkspaceAssets.php');
    const list = helper.match(/SUPPORTED = \[([\s\S]*?)\];/);
    expect(list).not.toBeNull();
    const supported = [...list[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
    expect(supported).toContain('delete-category-popup.css');
    expect(supported).toEqual([...supported].sort());
});

const declarations = text => {
    const out = [];
    postcss.parse(text).walkRules(rule => {
        for (const selector of rule.selectors) {
            rule.walkDecls(decl => out.push({ selector, prop: decl.prop, value: decl.value, important: Boolean(decl.important) }));
        }
    });
    return out;
};

test('the sheet is one screen-only block whose selectors all start at the scoped body', () => {
    const tree = postcss.parse(css());
    const nodes = tree.nodes.filter(node => node.type !== 'comment');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('atrule');
    expect(nodes[0].name).toBe('media');
    expect(nodes[0].params).toBe('screen');
    const nested = [];
    nodes[0].walkAtRules(rule => nested.push(rule.name));
    expect(nested).toEqual([]);
    tree.walkRules(rule => {
        for (const selector of rule.selectors) expect(selector === scope || selector.startsWith(`${scope} `)).toBe(true);
    });
});

const ink = 'var(--oe-wb-ink)';
const paper = 'var(--oe-wb-paper)';
const canvas = 'var(--oe-wb-canvas)';
const focusRing = { outline: '2px solid var(--oe-wb-petrol)', 'outline-offset': '1px' };

test('every declaration is on the allowlist, and the only !important is the body canvas', () => {
    const all = declarations(css());
    expect(all.length).toBeGreaterThan(0);
    const map = {};
    for (const { selector, prop, value, important } of all) {
        map[selector] ??= {};
        expect(map[selector][prop]).toBeUndefined(); // one declaration per property per selector
        map[selector][prop] = important ? `${value} !important` : value;
    }
    expect(map).toEqual({
        [scope]: { 'background-color': `${canvas} !important` },
        [form]: { color: ink, 'background-color': paper, padding: '12px', border: '1px solid var(--oe-wb-line)', 'border-radius': '6px' },
        [`${form} tr.reportTableHeadRow > th`]: { color: ink, 'background-color': canvas },
        [`${form} tr.reportTableOddRow > td`]: { color: ink, 'background-color': paper },
        [`${form} tr.reportTableEvenRow > td`]: { color: ink, 'background-color': paper },
        [`${form} a:focus`]: focusRing,
        [`${form} a:focus-visible`]: focusRing,
    });
    // Natural table: no font, display, sizing, clipping or hiding changes, and links keep their colour.
    for (const { selector, prop, value } of all) {
        expect(prop).not.toMatch(/^(font|display|width|min-width|max-width|height|overflow|visibility|position|table-layout|white-space|opacity)/);
        expect(value).not.toMatch(/^(none|0|hidden)$/);
        if (/\ba(:|$)/.test(selector)) expect(prop).not.toBe('color');
    }
});

test('focus fallback and :focus-visible are separate, state-homogeneous rules for the existing links', () => {
    const focusRules = [];
    postcss.parse(css()).walkRules(rule => {
        if (rule.selector.includes(':focus')) focusRules.push(rule);
    });
    expect(focusRules).toHaveLength(2);
    const states = focusRules.map(rule => {
        const kinds = new Set(rule.selectors.map(selector => (selector.endsWith(':focus-visible') ? 'visible' : selector.endsWith(':focus') ? 'focus' : 'other')));
        expect(kinds.size).toBe(1);
        return [...kinds][0];
    });
    expect(states.sort()).toEqual(['focus', 'visible']);
    const decls = focusRules.map(rule => {
        const out = {};
        rule.walkDecls(decl => { out[decl.prop] = decl.value; });
        return out;
    });
    expect(decls[0]).toEqual(focusRing);
    expect(decls[1]).toEqual(focusRing);
});

// Cascade resolution against explicitly hardcoded representative theme fragments, not
// compiled theme CSS and not validated against the theme sources. This models which
// declaration wins; it does not measure rendered contrast.
// color_base.scss gives every flat colour theme `.body_top{background-color:$paler!important}`
// (cobalt blue's $paler shown); tabs_style_full.scss styles .body_top without !important;
// style_manila.scss forces `.text{color:darken($danger,40%)!important}` (value elided).
const themes = {
    cobalt: '.body_top,.bgcolor2,.body_nav{background-color:#f3f7fb!important}',
    tabsFull: '.body_top{background-color:var(--light);color:var(--dark);margin:0;padding:0}',
    manila: '.text{color:manila-text-ink!important}',
};

const specificity = selector => {
    const bare = selector.replace(/\[[^\]]*\]/g, '.a').replace(/::[\w-]+/g, ' x');
    const ids = (bare.match(/#[\w-]+/g) || []).length;
    const classes = (bare.match(/\.[\w-]+|:[\w-]+/g) || []).length;
    const types = (bare.replace(/[#.:][\w-]+/g, ' ').match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
    return ids * 1e6 + classes * 1e3 + types;
};

// Theme first, then the shared popup frame, then this page's sheet; screen media applies.
const cascade = sheets => {
    const out = [];
    let order = 0;
    for (const text of sheets) {
        postcss.parse(text).walkRules(rule => {
            for (let parent = rule.parent; parent && parent.type === 'atrule'; parent = parent.parent) {
                if (parent.name !== 'media' || parent.params !== 'screen') return;
            }
            for (const selector of rule.selectors) {
                rule.walkDecls(decl => out.push({ selector, prop: decl.prop, value: decl.value, rank: [decl.important ? 1 : 0, specificity(selector), order++] }));
            }
        });
    }
    return out;
};
const beats = (a, b) => a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];
const declared = (element, prop, rules) => {
    let winner = null;
    for (const rule of rules) {
        if (rule.prop !== prop) continue;
        let matches = false;
        try { matches = element.matches(rule.selector); } catch { continue; }
        if (matches && (!winner || beats(rule.rank, winner.rank))) winner = rule;
    }
    return winner?.value;
};
// Colour inherits: the nearest element with its own winning declaration supplies it,
// whatever the importance of an ancestor's declaration.
const inherited = (element, prop, rules) => {
    for (let node = element; node; node = node.parentElement) {
        const value = declared(node, prop, rules);
        if (value !== undefined) return value;
    }
    return undefined;
};

const mount = () => {
    document.documentElement.className = 'oe-workbench-context oe-workbench-popup';
    document.body.className = 'body_top oe-delete-category';
    document.body.innerHTML = '<form name="myform" class="oe-delete-category-form"><table align="center">'
        + '<tr class="text reportTableHeadRow"><th>Sl.No</th><th>Delete</th></tr>'
        + "<tr class='text reportTableOddRow'><td>1</td><td><a href=#><img src='../../interface/pic/Delete.gif' border=0 title='Delete This Row'></a></td></tr>"
        + "<tr class='text reportTableEvenRow'><td>2</td><td><a href=#><img src='../../interface/pic/Delete.gif' border=0 title='Delete This Row'></a></td></tr>"
        + '</table></form>';
    return {
        body: document.body,
        form: document.querySelector('form'),
        header: document.querySelector('.reportTableHeadRow th'),
        cells: [...document.querySelectorAll('.reportTableOddRow td, .reportTableEvenRow td')],
        links: [...document.querySelectorAll('a')],
    };
};

test.each(Object.keys(themes))('under the %s theme the sheet paints canvas, paper and ink', theme => {
    const rules = cascade([themes[theme], popupCss(), css()]);
    const page = mount();
    expect(declared(page.body, 'background-color', rules)).toBe(canvas);
    expect(declared(page.form, 'background-color', rules)).toBe(paper);
    expect(inherited(page.form, 'color', rules)).toBe(ink);
    expect(declared(page.header, 'background-color', rules)).toBe(canvas);
    expect(inherited(page.header, 'color', rules)).toBe(ink);
    expect(page.cells).toHaveLength(4);
    for (const cell of page.cells) {
        expect(declared(cell, 'background-color', rules)).toBe(paper);
        expect(inherited(cell, 'color', rules)).toBe(ink);
    }
    // In this simplified model the image links inherit the cell ink. The model omits the
    // native Bootstrap anchor rules, so this is not native link-colour coverage.
    for (const link of page.links) expect(inherited(link, 'color', rules)).toBe(ink);
});

test('the body !important is required by the theme, and cell ink needs none', () => {
    const page = mount();
    // Without the sheet, the flat colour theme's forced paler wins over the popup frame.
    expect(declared(page.body, 'background-color', cascade([themes.cobalt, popupCss()]))).toBe('#f3f7fb');
    // The same body declaration without !important would still lose to it.
    const softened = postcss.parse(css());
    softened.walkDecls('background-color', decl => {
        if (decl.parent.selectors.includes(scope)) decl.important = false;
    });
    expect(declared(page.body, 'background-color', cascade([themes.cobalt, popupCss(), softened.toString()]))).toBe('#f3f7fb');
    expect(declared(page.body, 'background-color', cascade([themes.cobalt, popupCss(), css()]))).toBe(canvas);

    // Manila's !important .text ink reaches the cells only by inheritance from the row,
    // so the cells' own plain declarations override it.
    const withoutCells = postcss.parse(css());
    withoutCells.walkRules(rule => {
        if (/> t[dh]$/.test(rule.selector)) rule.remove();
    });
    expect(inherited(page.cells[0], 'color', cascade([themes.manila, popupCss(), withoutCells.toString()]))).toBe('manila-text-ink');
    expect(inherited(page.cells[0], 'color', cascade([themes.manila, popupCss(), css()]))).toBe(ink);
});
