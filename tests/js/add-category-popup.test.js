/**
 * TECH-65: the Nation Notes Add Category popup (library/custom_template/add_template.php) as
 * quiet document paper inside a workbench popup. The route keeps its original handlers, SQL,
 * escaping and markup; only the declared presentation edits may differ from the frozen fixture.
 */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readOptional = file => (fs.existsSync(path.join(root, file)) ? read(file) : '');
const count = (text, part) => text.split(part).length - 1;
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const route = () => read('library/custom_template/add_template.php');
const original = read('tests/clinical-ui/fixtures/add-category-original.txt');
const sheet = () => readOptional('interface/clinical-workspace/add-category-popup.css');

const SCOPE = 'html.oe-workbench-context.oe-workbench-popup body.body_top.oe-add-category';
const FORM = `${SCOPE} form.oe-add-category-form`;

// [original bytes, presented bytes]: the only edits the route may carry.
const edits = [
    ['use OpenEMR\\Core\\Header;', 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Core\\Header;\nuse OpenEMR\\Core\\OEGlobalsBag;'],
    ["        <?php Header::setupHeader('opener'); ?>", "        <?php Header::setupHeader('opener'); ?>\n        <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n        <link rel=\"stylesheet\" media=\"screen\" href=\"<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/add-category-popup.css?v=<?php echo attr_url($clinicalAssets->version('add-category-popup.css')); ?>\">"],
    ['<body class="body_top">', '<body class="body_top oe-add-category">'],
    ['<form >', '<form class="oe-add-category-form">'],
];

const apply = text => edits.reduce((result, [before, after]) => result.replace(before, () => after), text);

function restore(text) {
    let restored = text;
    for (const [before, after] of edits) {
        if (count(restored, after) !== 1) {
            return null;
        }
        restored = restored.replace(after, () => before);
    }
    return restored;
}

test('each declared edit anchors once in the frozen original', () => {
    for (const [before, after] of edits) {
        expect([before, count(original, before)]).toEqual([before, 1]);
        expect(after).not.toBe(before);
    }
    expect(restore(apply(original))).toBe(original);
});

test('only the declared presentation edits restore the exact original route', () => {
    const php = route();
    for (const [, after] of edits) {
        expect([after, count(php, after)]).toEqual([after, 1]);
    }
    expect(restore(php)).toBe(original);
});

const mutations = [
    ['context SQL', 'cl_list_type=2 AND cl_deleted=0', 'cl_list_type=3 AND cl_deleted=0'],
    ['ADD handler', 'onclick="add_template()"', 'onclick="add_template();return false;"'],
    ['opener target', 'mainform=window.opener.opener.document;', 'mainform=window.opener.document;'],
    ['synchronous save', 'async: false,', 'async: true,'],
    ['list_id escaping', 'js_escape($list_id)', '$list_id'],
    ['option escaping', "htmlspecialchars((string) $row['cl_list_item_long'], ENT_QUOTES)", "$row['cl_list_item_long']"],
    ['missing list_id default', "$list_id = $_REQUEST['list_id'];", "$list_id = $_REQUEST['list_id'] ?? '';"],
    ['CSRF field', '</form>', '<input type="hidden" name="csrf_token_form" value="">\n        </form>'],
    ['multiselect', '<select multiple name="multi_context[]"', '<select name="multi_context[]"'],
    ['control size', 'size="5"', 'size="8"'],
    ['table wrapper', '<table>', '<div class="oe-add-category-sheet"><table>'],
];

test.each(mutations)('the inverse rejects an unrelated %s edit', (name, anchor, replacement) => {
    const presented = apply(original);
    expect(count(original, anchor)).toBe(1);
    expect(count(presented, anchor)).toBe(1);
    const mutated = presented.replace(anchor, () => replacement);
    expect(mutated).not.toBe(presented);
    expect(restore(mutated)).not.toBe(original);
});

test('the caller and AJAX endpoint keep their inherited contract', () => {
    const caller = read('library/custom_template/personalize.php');
    expect(count(caller, '<a href="add_template.php?list_id=<?php echo attr($_REQUEST[\'list_id\']); ?>" onclick="top.restoreSession();" class="iframe_small btn btn-primary"')).toBe(1);
    expect(count(caller, "dlgopen('', '', 400, 250, '', '', {")).toBe(1);
    const ajax = read('library/custom_template/ajax_code.php');
    expect(count(ajax, 'if ($Source == "add_template") {')).toBe(1);
    expect(count(ajax, 'sqlStatement("INSERT INTO template_users (tu_user_id,tu_template_id) VALUES (?,?)", [$authUserID, $newid]);')).toBe(1);
});

test('the sheet basename is registered in sorted order', () => {
    const list = read('src/Common/Assets/ClinicalWorkspaceAssets.php').match(/SUPPORTED = \[([\s\S]*?)\];/)?.[1] ?? '';
    const names = [...list.matchAll(/'([^']+)'/g)].map(match => match[1]);
    expect(names).toContain('add-category-popup.css');
    expect(names).toEqual([...names].sort());
});

test('the sheet is screen only and every rule is scoped to the route body or form', () => {
    const tree = postcss.parse(sheet());
    const top = tree.nodes.filter(node => node.type !== 'comment');
    expect(top.map(node => `${node.type} ${node.name} ${node.params}`)).toEqual(['atrule media screen']);
    const scoped = new RegExp(`^${escapeRegExp(SCOPE)}( form\\.oe-add-category-form( \\S.*)?)?$`);
    const selectors = [];
    tree.walkRules(rule => {
        let depth = 0;
        for (let parent = rule.parent; parent.type === 'atrule'; parent = parent.parent) {
            expect(parent.name).toBe('media');
            depth++;
        }
        expect(rule.raws.before).toMatch(new RegExp(`\\n {${depth * 2}}$`));
        selectors.push(...rule.selectors);
    });
    expect(selectors).toEqual(expect.arrayContaining([SCOPE, FORM]));
    for (const selector of selectors) {
        expect(selector).toMatch(scoped);
        expect(selector).not.toMatch(/\.btn|\.text\b|(^|[\s>+~])(a|span|tr|td|table)(?![\w-])/);
    }
    expect(sheet()).not.toMatch(/\):not\(/);
});

test('declarations stay on a strict paint allowlist with one documented canvas override', () => {
    const tree = postcss.parse(sheet());
    const allowed = new Set(['color', 'background-color', 'border', 'border-color', 'border-radius', 'box-shadow', 'outline', 'outline-offset', 'padding', 'margin']);
    const tokens = new Set();
    postcss.parse(read('interface/clinical-workspace/popup.css')).walkDecls(/^--oe-wb-/, decl => tokens.add(decl.prop));
    const important = [];
    tree.walkDecls(decl => {
        expect(allowed).toContain(decl.prop);
        expect(decl.value).not.toMatch(/#[\da-f]{3,8}\b|\b(rgba?|hsla?)\(|\b(white|black|transparent|inherit|unset)\b/i);
        for (const [, name] of decl.value.matchAll(/var\((--[\w-]+)/g)) {
            expect(tokens).toContain(name);
        }
        for (const [, px] of decl.value.matchAll(/(\d+(?:\.\d+)?)px/g)) {
            expect(Number(px)).toBeLessThanOrEqual(decl.prop === 'border-radius' ? 8 : 24);
        }
        if (decl.important) {
            important.push(`${decl.parent.selector} { ${decl.prop}: ${decl.value} }`);
        }
    });
    expect(important).toEqual([`${SCOPE} { background-color: var(--oe-wb-canvas) }`]);
    const comments = [];
    tree.walkComments(comment => comments.push(comment.text));
    expect(comments.join('\n')).toMatch(/\.body_top[\s\S]*!important|!important[\s\S]*\.body_top/);
    expect(comments.join('\n')).toMatch(/\.text/);
});

test('canvas, paper and both controls carry paired ink in every state', () => {
    const tree = postcss.parse(sheet());
    const paint = new Map();
    tree.walkRules(rule => {
        const values = {};
        rule.walkDecls(decl => { values[decl.prop] = `${decl.value}${decl.important ? ' !important' : ''}`; });
        expect([rule.selector, 'color' in values]).toEqual([rule.selector, 'background-color' in values]);
        const visible = rule.selectors.filter(selector => selector.includes(':focus-visible'));
        if (visible.length > 0) {
            expect(visible).toEqual(rule.selectors);
        }
        for (const selector of rule.selectors) {
            paint.set(selector, { ...paint.get(selector), ...values });
        }
    });
    const ink = 'var(--oe-wb-ink)';
    const paper = 'var(--oe-wb-paper)';
    const focus = {
        color: ink,
        'background-color': paper,
        'border-color': 'var(--oe-wb-petrol)',
        outline: '2px solid var(--oe-wb-petrol)',
        'outline-offset': '1px',
        'box-shadow': 'none',
    };
    const states = {
        '': { color: ink, 'background-color': paper, 'border-color': 'var(--oe-wb-line)' },
        ':focus': focus,
        ':focus-visible': focus,
        ':disabled': { color: 'var(--oe-wb-disabled-ink)', 'background-color': 'var(--oe-wb-disabled-paper)', 'border-color': 'var(--oe-wb-line)' },
    };
    expect(paint.get(SCOPE)).toEqual({ color: ink, 'background-color': 'var(--oe-wb-canvas) !important' });
    expect(paint.get(FORM)).toMatchObject({ color: ink, 'background-color': paper, border: '1px solid var(--oe-wb-line)' });
    for (const control of ['#template_name', '#multi_context']) {
        for (const [state, expected] of Object.entries(states)) {
            expect([`${control}${state}`, paint.get(`${FORM} ${control}${state}`)]).toEqual([`${control}${state}`, expected]);
        }
    }
});
