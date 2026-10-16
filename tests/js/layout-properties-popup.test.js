/** @jest-environment jsdom */

// OPEMR-9: Edit Layout Properties (interface/super/edit_layout_props.php) as a screen-only
// workbench document. Source-level contract only: it proves the route is the frozen original
// plus four presentation edits and that the sheet is a scoped colour/focus palette. It does not
// prove native compiled contrast, rendered geometry, accessibility roles or that save still works.

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
// The sheet is created by the implementation; until then it reads as empty so tests fail on
// their assertions rather than crashing during setup.
const readOptional = file => (fs.existsSync(path.join(root, file)) ? read(file) : '');
const fixture = read('tests/clinical-ui/fixtures/layout-properties-original.txt');
const source = () => read('interface/super/edit_layout_props.php');
const css = () => readOptional('interface/clinical-workspace/layout-properties-popup.css');
const count = (text, part) => text.split(part).length - 1;

const link = '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/layout-properties-popup.css?v=<?php echo attr_url((new ClinicalWorkspaceAssets())->version(\'layout-properties-popup.css\')); ?>">\n';

// The only permitted presentation edits, as [original, presented].
const changes = [
    ['use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;\n',
        'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;\n'],
    ["    <?php Header::setupHeader('opener'); ?>\n", `    <?php Header::setupHeader('opener'); ?>\n${link}`],
    ['<body class="body_top">', '<body class="body_top oe-layout-properties-popup">'],
    ["<form method='post' action='edit_layout_props.php?", "<form method='post' class='oe-layout-properties-document' action='edit_layout_props.php?"],
];
const apply = (text, list) => list.reduce((t, [before, after]) => t.replace(before, () => after), text);
const planned = apply(fixture, changes);

// Accepts the untouched route or the route with every planned edit exactly once; anything
// partial or ambiguous is null, anything else comes back unchanged and so differs from the fixture.
const normalize = text => {
    const present = changes.map(([, after]) => count(text, after));
    if (present.every(n => n === 0)) return text;
    if (!present.every(n => n === 1)) return null;
    return changes.reduce((t, [before, after]) => t.replace(after, () => before), text);
};

test('the fixture is the frozen 555-line original route', () => {
    expect(fixture.endsWith('</html>\n')).toBe(true);
    expect(fixture.split('\n')).toHaveLength(556);
    expect(fixture).not.toMatch(/[\r\t]/);
    expect(fixture).not.toContain('layout-properties-popup');
    expect(fixture).not.toContain('ClinicalWorkspaceAssets');
});

test('every planned edit has a unique anchor, really changes the route and inverts exactly', () => {
    for (const [before, after] of changes) {
        expect(before).not.toBe(after);
        expect(count(fixture, before)).toBe(1);
        expect(count(fixture, after)).toBe(0);
        expect(count(planned, after)).toBe(1);
    }
    expect(normalize(fixture)).toBe(fixture);
    expect(normalize(planned)).toBe(fixture);
    // Any partial application is rejected.
    changes.forEach((_, skip) => expect(normalize(apply(fixture, changes.filter((__, i) => i !== skip)))).toBeNull());
});

test('the actual route is the original, untouched or with exactly the planned edits', () => {
    expect(normalize(source())).toBe(fixture);
});

test('negative controls: backend, security, escaping, control, codepicker and callback mutations break the inverse', () => {
    const mutations = [
        // ACL, session and CSRF
        ["AclMain::aclCheckCore('admin', 'super')", "AclMain::aclCheckCore('admin', 'users')"],
        ['$session = SessionWrapperFactory::getInstance()->getActiveSession();', '$session = null;'],
        ['    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);\n', ''],
        ['CsrfUtils::collectCsrfToken(session: $session)', "''"],
        ['name="csrf_token_form"', 'name="csrf_token"'],
        // layout and group scoping, SQL
        ["$group_id  = empty($_GET['group_id' ]) ? '' : $_GET['group_id' ];", "$group_id  = '';"],
        ['[$layout_id, $group_id]', "[$layout_id, '']"],
        ['"UPDATE layout_group_properties SET $sets "', '"REPLACE layout_group_properties SET $sets "'],
        ['"WHERE grp_form_id = ? AND grp_group_id = ?",', '"WHERE grp_form_id = ?",'],
        ['"SET $sets, grp_form_id = ?, grp_group_id = \'\'"', '"SET $sets, grp_form_id = ?"'],
        // validation
        ["preg_match('/(LBF|LBT|HIS)", "preg_match('/(LBF|LBT)"],
        ["$alertmsg = xl('Layout ID is required');", "$alertmsg = '';"],
        ["if ($form_title == '' && !$group_id) {", "if ($form_title == '') {"],
        // Gacl
        ["$gacl->get_objects(null, 0, 'ACO')", "$gacl->get_objects(null, 1, 'ACO')"],
        // escaping
        ['attr_url($layout_id)', '$layout_id'],
        ['echo text($layout_id);', 'echo $layout_id;'],
        ['js_escape($layout_id)', '$layout_id'],
        ['xla($aco_section_title)', '$aco_section_title'],
        // controls
        ["name='form_columns' class='form-control'", "name='form_cols' class='form-control'"],
        ["type='submit' class='btn btn-primary' name='form_submit'", "type='button' class='btn btn-primary' name='form_submit'"],
        ["onclick='window.close()'", "onclick=''"],
        // codepicker and opener callbacks
        ['<?php require(OEGlobalsBag::getInstance()->getSrcDir() . "/restoreSession.php"); ?>', ''],
        ['onclick=\'sel_related(this, "MA")\'', 'onclick=\'sel_related(this, "PROD")\''],
        ["dlgopen(url, '_blank', 800, 500);", "dlgopen(url, '_blank', 900, 600);"],
        ['find_code_dynamic.php', 'find_code.php'],
        ['function set_related(codetype, code, selector, codedesc) {', 'function set_related_codes(codetype, code, selector, codedesc) {'],
        ['my_del_related(s, f[current_sel_name], false);', 'my_del_related(s, f[current_sel_name], true);'],
        ["return f[current_sel_name].value.split(';');", "return f[current_sel_name].value.split(',');"],
        ['opener.refreshme(', 'opener.refresh('],
        // legacy typography, wrapper and table
        ['td { font-size:10pt; }', 'td { font-size:12pt; }'],
        ['<center>', '<div>'],
        ["<table class='w-100 border-0'>", "<table class='w-100 border-0 oe-extra'>"],
    ];
    for (const [from, to] of mutations) {
        expect(from).not.toBe(to);
        for (const base of [fixture, planned]) {
            expect(count(base, from)).toBe(1);
            expect(normalize(base.replace(from, () => to))).not.toBe(fixture);
        }
    }
});

test('the layout editor still opens the route at 775x550 and receives refreshme', () => {
    const caller = read('interface/super/edit_layout.php');
    expect(count(caller, "dlgopen('edit_layout_props.php?' + params,\n  '_blank', 775, 550, \"\", title);")).toBe(1);
    expect(count(caller, "function refreshme(layout_id) {\n location.href = 'edit_layout.php?layout_id=' + encodeURIComponent(layout_id);")).toBe(1);
    expect(count(planned, ' if (opener.refreshme) opener.refreshme(" . js_escape($layout_id) . ");\\n";')).toBe(1);
});

test('presentation: the route carries the four planned edits', () => {
    const php = source();
    for (const [, after] of changes) expect(count(php, after)).toBe(1);
    expect(count(php, 'layout-properties-popup.css')).toBe(2);
    expect(php).not.toContain('workspace.css');
    expect(php.match(/<body[ >]/g)).toHaveLength(1);
    expect(php.match(/<form[ >]/g)).toHaveLength(1);
});

// The asset helper is controller-owned: the whole file is recorded here as it stood before this
// story, so any edit other than the one planned list entry is rejected, not just name-list edits.
const helperPath = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const helperBaseline = String.raw`<?php

/**
 * Per-file cache versions for the clinical workspace screen assets.
 *
 * Views that link interface/clinical-workspace assets directly append
 * ?v=<version> so a browser refetches a file as soon as it changes. Keeping
 * the filesystem lookup here keeps the view's URL expression free of
 * filesystem roots, and confines which files may be stat()ed to a fixed list.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Common\Assets;

final readonly class ClinicalWorkspaceAssets
{
    /**
     * Supported asset basenames. The directory defaults to the clinical
     * workspace; a legacy tooltip caller supplies library/js explicitly.
     */
    private const SUPPORTED = [
        'ajtooltip.js',
        'appointment.css',
        'calendar-sidebar.js',
        'calendar-workday.css',
        'calendar-workday.js',
        'encounter-document.css',
        'finder.css',
        'global-messages.css',
        'history-document.css',
        'history-editor.css',
        'issue-popup.css',
        'lbf-document.css',
        'mode.js',
        'patient-messages.css',
        'patient-picker-popup.css',
        'patient-results-popup.css',
        'patient-search.css',
        'soap-document.css',
        'soap-document.js',
        'soap-reference.css',
        'soap-reference.js',
        'visit-history.css',
        'visit-history.js',
        'workspace.css',
    ];

    private string $directory;

    /**
     * @param ?string $directory Directory holding the assets; defaults to the
     *                           shipped interface/clinical-workspace.
     */
    public function __construct(?string $directory = null)
    {
        $this->directory = $directory ?? dirname(__DIR__, 3) . '/interface/clinical-workspace';
    }

    /**
     * Modification time of a supported asset as a decimal string, or '0'
     * when the file is absent.
     *
     * @throws \InvalidArgumentException when $asset is not a supported name
     */
    public function version(string $asset): string
    {
        if (!in_array($asset, self::SUPPORTED, true)) {
            throw new \InvalidArgumentException('Unsupported clinical workspace asset');
        }

        $path = $this->directory . '/' . $asset;
        clearstatcache(true, $path);
        if (!is_file($path)) {
            return '0';
        }
        $mtime = filemtime($path);

        return $mtime === false ? '0' : sprintf('%d', $mtime);
    }
}
`;
const helperEntry = "        'layout-properties-popup.css',\n";
const helperAnchor = "        'issue-popup.css',\n";
const helperPlanned = helperBaseline.replace(helperAnchor, () => helperAnchor + helperEntry);
// Accepts only the recorded baseline (tests phase) or the baseline plus exactly the one entry in
// its sorted slot; every other byte of the helper must be unchanged.
const helperAccepted = text => text === helperBaseline
    || (count(text, helperEntry) === 1 && text.replace(helperEntry, '') === helperBaseline && text === helperPlanned);

test('the helper baseline is self-consistent and the planned entry inverts exactly', () => {
    expect(helperBaseline.endsWith('}\n')).toBe(true);
    expect(helperBaseline).toContain('throw new \\InvalidArgumentException');
    expect(count(helperBaseline, helperAnchor)).toBe(1);
    expect(count(helperBaseline, helperEntry)).toBe(0);
    expect(count(helperPlanned, helperEntry)).toBe(1);
    expect(helperPlanned).not.toBe(helperBaseline);
    expect(helperPlanned.replace(helperEntry, '')).toBe(helperBaseline);
    expect(helperAccepted(helperBaseline)).toBe(true);
    expect(helperAccepted(helperPlanned)).toBe(true);
});

test('the actual helper is the recorded baseline, untouched or with exactly the one planned entry', () => {
    expect(helperAccepted(read(helperPath))).toBe(true);
});

test('negative controls: helper code mutations and misplaced or duplicated entries are rejected', () => {
    const mutations = [
        ['in_array($asset, self::SUPPORTED, true)', 'in_array($asset, self::SUPPORTED)'],
        ["throw new \\InvalidArgumentException('Unsupported clinical workspace asset');", "return '0';"],
        ['        clearstatcache(true, $path);\n', ''],
        ["return $mtime === false ? '0' : sprintf('%d', $mtime);", 'return (string) $mtime;'],
        ["'/interface/clinical-workspace'", "'/interface/themes'"],
        ['final readonly class', 'class'],
        ['declare(strict_types=1);', 'declare(strict_types=0);'],
        ["        'workspace.css',\n", "        'workspace.css',\n        'layout.css',\n"],
        [' * @author    Craig Allen', ' * @author    Someone Else'],
    ];
    for (const [from, to] of mutations) {
        expect(from).not.toBe(to);
        for (const base of [helperBaseline, helperPlanned]) {
            expect(count(base, from)).toBe(1);
            expect(helperAccepted(base.replace(from, () => to))).toBe(false);
        }
    }
    // The entry duplicated, or added outside its sorted slot, is also rejected.
    expect(helperAccepted(helperPlanned.replace(helperEntry, () => helperEntry + helperEntry))).toBe(false);
    expect(helperAccepted(helperBaseline.replace("        'workspace.css',\n", () => `        'workspace.css',\n${helperEntry}`))).toBe(false);
    expect(helperAccepted(helperBaseline.replace(' */\n\ndeclare', () => ` */\n${helperEntry}\ndeclare`))).toBe(false);
});

test('presentation: the asset helper allows exactly the new sheet (controller-owned)', () => {
    const helper = read(helperPath);
    const entry = helperEntry;
    const names = text => [...((text.match(/SUPPORTED = \[([\s\S]*?)\];/) || [])[1] || '').matchAll(/'([^']+)'/g)].map(m => m[1]);
    expect(count(helper, entry)).toBe(1);
    const inverse = helper.replace(entry, '');
    expect(inverse).not.toContain('layout-properties-popup');
    const listed = names(helper);
    expect(listed).toEqual([...listed].sort());
    expect(new Set(listed).size).toBe(listed.length);
    expect(names(inverse)).toEqual(listed.filter(name => name !== 'layout-properties-popup.css'));
    expect(helper).toBe(helperPlanned);
});

// ---- Stylesheet contract -------------------------------------------------------------------

const scope = 'body.oe-workbench-context.oe-layout-properties-popup';
const doc = `${scope} .oe-layout-properties-document`;
const neutral = '.form-control:not(.is-invalid, .is-valid, .was-validated *)';
const field = `${doc} ${neutral}`;
const checkbox = `${doc} input[type='checkbox']`;
const button = `${doc} input.btn`;
const canvas = { 'background-color': '#edf2f3', color: '#182c36' };
const paper = { 'background-color': '#fff', color: '#182c36' };

const rules = () => {
    const out = [];
    postcss.parse(css()).walkRules(rule => {
        const decls = {};
        rule.walkDecls(d => { decls[d.prop] = `${d.value}${d.important ? ' !important' : ''}`.toLowerCase(); });
        out.push({ selectors: rule.selectors, decls });
    });
    return out;
};
const selectors = () => rules().flatMap(r => r.selectors);
const declsFor = selector => Object.assign({}, ...rules().filter(r => r.selectors.includes(selector)).map(r => r.decls));

const hex = value => {
    expect(value).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    return value.length === 4 ? `#${[...value.slice(1)].map(c => c + c).join('')}` : value;
};
const luminance = value => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex(value).slice(i, i + 2), 16) / 255)
        .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

test('the sheet is one screen-only block of scoped colour, outline and placeholder declarations', () => {
    const tree = postcss.parse(css());
    const top = tree.nodes.filter(node => node.type !== 'comment');
    expect(top).toHaveLength(1);
    expect(top[0].type).toBe('atrule');
    expect(top[0].name).toBe('media');
    expect(top[0].params).toBe('screen');
    tree.walkAtRules(at => expect(at).toBe(top[0]));
    expect(rules().length).toBeGreaterThan(8);
    expect(css()).not.toMatch(/!important|@import|workspace\.css/i);
    const allowed = ['color', 'background-color', 'outline', 'outline-offset', 'opacity'];
    for (const { selectors: list, decls } of rules()) {
        for (const selector of list) {
            expect(selector === scope || selector.startsWith(`${scope} `)).toBe(true);
            if (selector.includes('.form-control')) expect(selector).toContain(`.oe-layout-properties-document ${neutral}`);
            expect(selector.replace(/::placeholder$/, '')).not.toContain('::');
            if (selector.includes('.btn')) expect(Object.keys(decls).filter(p => p === 'color' || p === 'background-color')).toEqual([]);
            if (decls.outline !== undefined || decls['outline-offset'] !== undefined) expect(selector).toMatch(/:focus(-visible)?$/);
            if (decls.opacity !== undefined) expect(selector).toMatch(/::placeholder$/);
        }
        // :focus-visible stays in its own rule so an unsupported selector cannot drop the :focus fallback.
        if (list.some(s => s.includes(':focus-visible'))) {
            expect(list.every(s => s.endsWith(':focus-visible'))).toBe(true);
            expect(Object.keys(decls).every(p => p === 'outline' || p === 'outline-offset')).toBe(true);
        }
        for (const prop of Object.keys(decls)) expect(allowed).toContain(prop);
        // Foreground and background are always declared as a pair (placeholders inherit the field paper).
        if (!list.every(s => s.endsWith('::placeholder'))) {
            expect(decls.color === undefined).toBe(decls['background-color'] === undefined);
        }
    }
});

// Closed structural contract as a pure function, so it can be exercised against known-bad sheets.
// Selectors come from a fixed allowlist: a scoped prefix alone no longer licenses repainting
// arbitrary descendants. This is a source-level oracle only; it does not model the native cascade.
const allowedSelectors = new Set([
    scope, doc, `${doc} td`, field, `${field}:disabled`, `${field}[readonly]`, `${field}::placeholder`,
    ...[field, checkbox, button].flatMap(target => [`${target}:focus`, `${target}:focus-visible`]),
]);
const allowedProps = ['color', 'background-color', 'outline', 'outline-offset', 'opacity'];
const contractProblems = text => {
    const problems = [];
    const tree = postcss.parse(text);
    const top = tree.nodes.filter(node => node.type !== 'comment');
    const media = top.length === 1 && top[0].type === 'atrule' && top[0].name === 'media' && top[0].params === 'screen' ? top[0] : null;
    if (!media) problems.push('not exactly one @media screen block');
    tree.walkAtRules(at => { if (at !== media) problems.push(`extra at-rule @${at.name}`); });
    if (/!important|@import|workspace\.css/i.test(text)) problems.push('forbidden token');
    tree.walkRules(rule => {
        if (!media || rule.parent !== media) problems.push(`rule outside @media screen: ${rule.selector}`);
        const decls = {};
        rule.walkDecls(d => {
            const prop = d.prop.toLowerCase();
            if (d.important) problems.push(`!important on ${prop}`);
            if (!allowedProps.includes(prop)) problems.push(`property ${prop}`);
            decls[prop] = d.value.toLowerCase();
        });
        for (const s of rule.selectors) {
            if (!allowedSelectors.has(s)) problems.push(`selector ${s}`);
            if ((decls.outline !== undefined || decls['outline-offset'] !== undefined) && !/:focus(-visible)?$/.test(s)) problems.push(`outline off focus: ${s}`);
            if (decls.opacity !== undefined && !s.endsWith('::placeholder')) problems.push(`opacity off placeholder: ${s}`);
            if (s.includes('.btn') && (decls.color !== undefined || decls['background-color'] !== undefined)) problems.push(`button repaint: ${s}`);
        }
        const visible = rule.selectors.filter(s => s.endsWith(':focus-visible')).length;
        if (visible && visible !== rule.selectors.length) problems.push(`mixed :focus-visible rule: ${rule.selector}`);
        if (visible && Object.keys(decls).some(p => p !== 'outline' && p !== 'outline-offset')) problems.push(`non-outline in :focus-visible rule: ${rule.selector}`);
        if (!rule.selectors.every(s => s.endsWith('::placeholder')) && (decls.color === undefined) !== (decls['background-color'] === undefined)) {
            problems.push(`unpaired colour: ${rule.selector}`);
        }
    });
    return problems;
};

const goodRules = [
    `${scope} { color: #182c36; background-color: #edf2f3; }`,
    `${doc} { color: #182c36; background-color: #fff; }`,
    `${doc} td { color: #182c36; background-color: #fff; }`,
    `${field} { color: #182c36; background-color: #fff; }`,
    `${field}::placeholder { color: #4d5f68; opacity: 1; }`,
    `${field}:focus, ${checkbox}:focus, ${button}:focus { outline: 2px solid #0b5cad; outline-offset: 2px; }`,
    `${field}:focus-visible, ${checkbox}:focus-visible, ${button}:focus-visible { outline: 2px solid #0b5cad; outline-offset: 2px; }`,
];
const wrap = list => `@media screen {\n${list.map(r => `    ${r}`).join('\n')}\n}\n`;
const goodSheet = wrap(goodRules);

test('the actual sheet satisfies the closed structural contract', () => {
    expect(contractProblems(css())).toEqual([]);
});

test('negative oracles: out-of-scope, unlisted repaint, geometry, !important and mixed focus rules are rejected', () => {
    expect(contractProblems(goodSheet)).toEqual([]);
    const swap = (index, rule) => wrap(goodRules.map((r, i) => (i === index ? rule : r)));
    const bad = [
        ['unscoped selector', wrap([...goodRules, '.oe-layout-properties-document td { color: #182c36; background-color: #fff; }']), /^selector \.oe-layout/],
        ['other page scope', wrap([...goodRules, `body.oe-layout-properties-popup .oe-layout-properties-document td { color: #182c36; background-color: #fff; }`]), /^selector body\.oe-layout/],
        ['scoped but unlisted descendant repaint', wrap([...goodRules, `${scope} .navbar { color: #fff; background-color: #182c36; }`]), /^selector .* \.navbar$/],
        ['deeper descendant of an allowed target', wrap([...goodRules, `${doc} td span { color: #182c36; background-color: #fff; }`]), /^selector .* td span$/],
        ['geometry on the document', swap(1, `${doc} { color: #182c36; background-color: #fff; width: 100%; }`), /^property width$/],
        ['geometry on a cell', swap(2, `${doc} td { color: #182c36; background-color: #fff; padding: 4px; }`), /^property padding$/],
        ['!important', swap(2, `${doc} td { color: #182c36 !important; background-color: #fff; }`), /^!important on color$/],
        ['mixed :focus and :focus-visible', wrap([...goodRules.slice(0, 5), `${field}:focus, ${field}:focus-visible { outline: 2px solid #0b5cad; }`]), /^mixed :focus-visible rule/],
        ['rule outside @media screen', `${wrap(goodRules)}${doc} td { color: #182c36; background-color: #fff; }\n`, /^rule outside @media screen/],
        ['print media instead of screen', goodSheet.replace('@media screen', '@media print'), /^not exactly one @media screen block$/],
    ];
    for (const [name, text, expected] of bad) {
        const problems = contractProblems(text);
        expect({ name, matched: problems.some(p => expected.test(p)) }).toEqual({ name, matched: true });
    }
});

test('canvas and document paper use the workbench palette; table cells and fields pair legibly', () => {
    expect(declsFor(scope)).toMatchObject(canvas);
    expect(declsFor(doc)).toMatchObject(paper);
    for (const selector of [`${doc} td`, field, `${field}:focus`, `${field}:disabled`, `${field}[readonly]`]) {
        const decls = declsFor(selector);
        expect(contrast(decls.color, decls['background-color'])).toBeGreaterThanOrEqual(4.5);
    }
    const placeholder = declsFor(`${field}::placeholder`);
    expect(placeholder.opacity).toBe('1');
    expect(contrast(placeholder.color, declsFor(field)['background-color'])).toBeGreaterThanOrEqual(4.5);
});

test('fields, checkboxes and the original Submit/Cancel buttons get :focus and separate :focus-visible outlines', () => {
    for (const target of [field, checkbox, button]) {
        for (const state of [':focus', ':focus-visible']) {
            const outline = declsFor(`${target}${state}`).outline;
            expect(outline).toBeDefined();
            expect(outline).not.toMatch(/^(none|0)(\s|$)/);
            expect(outline).toMatch(/^[1-9]\d*px solid #[0-9a-f]{3,6}$/);
            expect(contrast(outline.split(' ').pop(), paper['background-color'])).toBeGreaterThanOrEqual(3);
        }
    }
    expect(css()).not.toMatch(/outline(-width)?\s*:\s*(none|0)\b/i);
    for (const selector of selectors().filter(s => s.endsWith(':focus-visible'))) {
        expect(selectors()).toContain(selector.replace(/:focus-visible$/, ':focus'));
    }
});

// Live DOM check: the real selectors are matched against mounted controls, including Bootstrap
// validation states. Selector errors are not caught. ::placeholder rules are matched on their host
// input; :focus-visible rules are covered by the :focus parity check above.
test('field rules reach plain, disabled, readonly and focused controls but never validation states', () => {
    document.body.className = 'oe-workbench-context oe-layout-properties-popup';
    document.body.innerHTML = `
        <form class="oe-layout-properties-document"><table><tr><td>
            <input class="form-control" id="plain"><input class="form-control" id="locked" disabled>
            <input class="form-control" id="ro" readonly><input class="form-control is-invalid" id="invalid">
            <input class="form-control is-valid" id="valid"><input type="checkbox" id="box">
        </td></tr></table>
        <input type="submit" class="btn btn-primary" id="submit"><input type="button" class="btn btn-secondary" id="cancel"></form>
        <form class="oe-layout-properties-document was-validated"><input class="form-control" id="validated" required></form>`;
    const el = id => document.getElementById(id);
    const live = selectors().filter(s => !s.endsWith(':focus-visible')).map(s => s.replace(/::placeholder$/, ''));
    const fieldRules = live.filter(s => s.includes('.form-control'));
    expect(fieldRules.length).toBeGreaterThan(4);

    expect(el('plain').matches(field)).toBe(true);
    expect(el('locked').matches(`${field}:disabled`)).toBe(true);
    expect(el('plain').matches(`${field}:disabled`)).toBe(false);
    expect(el('ro').matches(`${field}[readonly]`)).toBe(true);
    expect(el('box').matches(`${doc} td`)).toBe(false);
    expect(el('box').closest('td').matches(`${doc} td`)).toBe(true);

    for (const id of ['plain', 'invalid', 'valid', 'validated', 'box', 'submit', 'cancel']) {
        el(id).focus();
        expect(document.activeElement).toBe(el(id));
        for (const selector of fieldRules) {
            if (['invalid', 'valid', 'validated'].includes(id)) expect(el(id).matches(selector)).toBe(false);
        }
        if (id === 'plain') expect(el(id).matches(`${field}:focus`)).toBe(true);
        if (id === 'box') expect(el(id).matches(`${checkbox}:focus`)).toBe(true);
        if (id === 'submit' || id === 'cancel') expect(el(id).matches(`${button}:focus`)).toBe(true);
    }
    expect(live.every(selector => document.querySelectorAll(selector).length >= 0)).toBe(true);
});
