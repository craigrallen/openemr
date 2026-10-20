'use strict';
/*
 * OPEMR-70 multi-code selector (interface/patient_file/encounter/select_codes.php).
 *
 * Dependency-free node:test contract. Node built-ins only: no jsdom, postcss or yaml.
 *
 *   Portable:  node tests/isolated/multi-code-selector-contract.cjs
 *   History:   node tests/isolated/multi-code-selector-contract.cjs --history
 *              (or MULTI_CODE_SELECTOR_HISTORY=1). Mandatory before merge; needs git and
 *              the full base commit, and fails rather than skips when either is missing.
 *
 * The production route may differ from the fixture only by the two additions in
 * ADDITIONS. Undoing exactly those must reproduce the fixture byte for byte.
 *
 * The popup.js checks run the real shared popup engine in node:vm against hand-built
 * window objects. They are SYNTHETIC, NOT NATIVE: no browser, layout, cascade or paint.
 */

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test, describe } = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const ROUTE = 'interface/patient_file/encounter/select_codes.php';
const FIXTURE = 'tests/fixtures/multi-code-selector-original.php.txt';
const POPUP_JS = 'interface/clinical-workspace/popup.js';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const BASE = '18647270e0c799189d2dc10f801e8de2bff1a360';
const HISTORY = process.argv.includes('--history') || process.env.MULTI_CODE_SELECTOR_HISTORY === '1';
const ALLOWLIST = [
    ROUTE,
    FIXTURE,
    'tests/isolated/multi-code-selector-contract.cjs',
    'tests/js/multi-code-selector.test.js',
    'docs/clinical-ui/MULTI-CODE-SELECTOR.md',
];

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const count = (text, part) => text.split(part).length - 1;

const GATE = 'html.oe-workbench-context body#codes_search.oe-multi-code-selector';

// The style block exactly as the route carries it (4-space head indent, 8-space body).
const STYLE_BLOCK = [
    '    <style>',
    '        @media screen {',
    '          html.oe-workbench-context body#codes_search.oe-multi-code-selector {',
    '            color: var(--oe-wb-ink);',
    '            background-color: var(--oe-wb-canvas);',
    '          }',
    '',
    '          html.oe-workbench-context body#codes_search.oe-multi-code-selector #my_data_table {',
    '            color: var(--oe-wb-ink);',
    '            background-color: var(--oe-wb-paper);',
    '          }',
    '        }',
    '    </style>',
    '',
].join('\n');

// The same CSS after dedent: selectors at 2 spaces, declarations at 4.
const EXPECTED_CSS = [
    '@media screen {',
    '  html.oe-workbench-context body#codes_search.oe-multi-code-selector {',
    '    color: var(--oe-wb-ink);',
    '    background-color: var(--oe-wb-canvas);',
    '  }',
    '',
    '  html.oe-workbench-context body#codes_search.oe-multi-code-selector #my_data_table {',
    '    color: var(--oe-wb-ink);',
    '    background-color: var(--oe-wb-paper);',
    '  }',
    '}',
].join('\n');

// [name, original, presented]. Nothing else may change in the route.
const ADDITIONS = [
    ['screen style before </head>', '    </script>\n\n</head>\n', `    </script>\n\n${STYLE_BLOCK}\n</head>\n`],
    ['body class', '<body id="codes_search">', '<body id="codes_search" class="oe-multi-code-selector">'],
];

// Behaviour the presentation must not touch, each expected exactly once.
const PRESERVED = [
    ['session bootstrap', "require_once('../../globals.php');"],
    ['active session', '$session = SessionWrapperFactory::getInstance()->getActiveSession();'],
    ['CSRF token for the AJAX source', 'CsrfUtils::collectCsrfToken(session: $session)'],
    ['AJAX URL', '"sAjaxSource": "find_code_dynamic_ajax.php?csrf_token_form=" + '],
    ['allowed code types parse', '$allowed_codes = split_csv_line($codetype);'],
    ['code type sent to AJAX', 'aoData.push({"name": "codetype", "value": document.forms[0].form_code_type.value});'],
    ['inactive flag sent to AJAX', 'aoData.push({"name": "inactive", "value": (document.forms[0].form_include_inactive.checked ? 1 : 0)});'],
    ['row selection toggle', 'oSelectedIDs[this.id] = oSelectedIDs[this.id] ? 0 : 1;'],
    ['row selection weight', "row.style.fontWeight = oSelectedIDs[row.id] ? 'bold' : 'normal';"],
    ['opener callback', "var msg = opener.OnCodeSelected(jobj['codetype'], code[0], code[1], jobj['description']);"],
    ['closed-opener guard', 'if (opener.closed || !opener.OnCodeSelected) {'],
    ['dialog close after OK', 'dlgclose()\n                return false;'],
    ['OK button', "onclick='onOK()'>\" . xla('Ok')"],
    ['Cancel button', "onclick='dlgclose()'>\" . xla('Cancel')"],
    ['inactive checkbox', "<input type='checkbox' name='form_include_inactive' value='1' onclick='oTable.fnDraw()' />"],
    ['single code type input', "<input type='text' name='form_code_type' value='\" . attr($codetype) . \"' size='5' readonly />"],
    ['table id and classes', '<table id="my_data_table" class="table table-sm">'],
    ['table-responsive exception', '<!-- Exception here: Do not use table-responsive as it breaks datatables !-->'],
    ['Header assets', "Header::setupHeader(['opener', 'datatables', 'datatables-bs', 'datatables-colreorder']);"],
];

const ALLOWED_PROPS = new Set(['color', 'background-color']);
const ALLOWED_VALUES = new Set(['var(--oe-wb-ink)', 'var(--oe-wb-canvas)', 'var(--oe-wb-paper)']);
const FORBIDDEN_PROP = /^(font|width|height|min-|max-|margin|padding|display|position|top|left|right|bottom|overflow|visibility|pointer-events|opacity|z-index|transform|transition|border|outline|box-shadow|cursor|line-height|letter-spacing|text-transform|white-space|float|flex|grid)/;
const FORBIDDEN_TARGET = /(^|[\s>+~])(td|th|tr|thead|tbody|input|select|button|label|p)\b|\.(alert|btn|dataTables_|table-responsive|text-|bg-|moreResults|form-control)|:(hover|focus|disabled|checked|invalid|valid)|\[readonly\]|oe-workbench-popup/;

function apply(text) {
    let out = text;
    for (const [name, before, after] of ADDITIONS) {
        if (count(out, before) !== 1) throw new Error(`fixture anchor not unique: ${name}`);
        out = out.replace(before, () => after);
    }
    return out;
}

// Undo exactly the additions; null when any is missing or ambiguous.
function restore(text) {
    let out = text;
    for (const [, before, after] of ADDITIONS) {
        if (count(out, after) !== 1) return null;
        out = out.replace(after, () => before);
    }
    return out;
}

// Undo whichever additions are present (sanity check of the fixture only).
function restoreLenient(text) {
    let out = text;
    for (const [, before, after] of ADDITIONS) {
        if (count(out, after) === 1) out = out.replace(after, () => before);
    }
    return out;
}

function firstDifference(a, b) {
    const left = a.split('\n');
    const right = b.split('\n');
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
        if (left[i] !== right[i]) return `line ${i + 1}: ${JSON.stringify(left[i])} vs ${JSON.stringify(right[i])}`;
    }
    return 'trailing bytes';
}

function dedent(inner) {
    const lines = inner.split('\n');
    if (lines[0].trim() === '') lines.shift();
    if (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    const indents = lines.filter((l) => l.trim() !== '').map((l) => l.match(/^ */)[0].length);
    const min = indents.length ? Math.min(...indents) : 0;
    return lines.map((l) => (l.trim() === '' ? '' : l.slice(min))).join('\n');
}

// Minimal CSS reader for the inline block: at-rules, rules and declarations.
function parseCss(text) {
    const src = text.replace(/\/\*[\s\S]*?\*\//g, '');
    let i = 0;
    const block = (nested) => {
        const nodes = [];
        while (i < src.length) {
            while (i < src.length && /\s/.test(src[i])) i++;
            if (i >= src.length) break;
            if (src[i] === '}') {
                if (!nested) throw new Error('unbalanced }');
                i++;
                return nodes;
            }
            const open = src.indexOf('{', i);
            if (open < 0) throw new Error('missing {');
            const head = src.slice(i, open).trim();
            i = open + 1;
            if (head.startsWith('@')) {
                const match = head.match(/^@([\w-]+)\s*(.*)$/s);
                nodes.push({ type: 'atrule', name: match[1], params: match[2].trim(), nodes: block(true) });
                continue;
            }
            const close = src.indexOf('}', i);
            if (close < 0) throw new Error('missing }');
            const body = src.slice(i, close);
            if (body.includes('{')) throw new Error('nested block inside a rule');
            i = close + 1;
            const decls = body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
                const colon = d.indexOf(':');
                const value = d.slice(colon + 1).trim();
                return { prop: d.slice(0, colon).trim(), value: value.replace(/\s*!important$/i, ''), important: /!important$/i.test(value) };
            });
            nodes.push({ type: 'rule', selectors: head.split(',').map((s) => s.trim()), decls });
        }
        if (nested) throw new Error('unclosed block');
        return nodes;
    };
    return block(false);
}

function cssProblems(css) {
    const problems = [];
    if (css !== EXPECTED_CSS) problems.push(`style block differs from the pinned CSS at ${firstDifference(css, EXPECTED_CSS)}`);
    let tree;
    try {
        tree = parseCss(css);
    } catch (error) {
        return [...problems, `style block does not parse: ${error.message}`];
    }
    if (tree.length !== 1 || tree[0].type !== 'atrule' || tree[0].name !== 'media' || tree[0].params !== 'screen') {
        problems.push('style must be a single @media screen block (print keeps legacy rendering)');
    }
    const rules = [];
    const walk = (nodes, depth) => nodes.forEach((node) => {
        if (node.type === 'atrule') {
            if (depth > 0) problems.push(`nested at-rule @${node.name}`);
            walk(node.nodes, depth + 1);
        } else {
            rules.push(node);
        }
    });
    walk(tree, 0);
    if (rules.length !== 2) problems.push(`expected exactly 2 rules, found ${rules.length}`);
    for (const rule of rules) {
        if (rule.selectors.length !== 1) problems.push(`selector list instead of one selector: ${rule.selectors.join(', ')}`);
        for (const selector of rule.selectors) {
            if (selector !== GATE && !selector.startsWith(`${GATE} `)) problems.push(`selector escapes the workbench gate: ${selector}`);
            if (selector !== GATE && selector !== `${GATE} #my_data_table`) problems.push(`unexpected target: ${selector}`);
            if (FORBIDDEN_TARGET.test(selector.slice(GATE.length))) problems.push(`selector reaches a semantic or control target: ${selector}`);
        }
        for (const decl of rule.decls) {
            if (decl.important) problems.push(`!important on ${decl.prop}`);
            if (FORBIDDEN_PROP.test(decl.prop)) problems.push(`geometry, font, visibility or interaction property: ${decl.prop}`);
            else if (!ALLOWED_PROPS.has(decl.prop)) problems.push(`unexpected property: ${decl.prop}`);
            if (!ALLOWED_VALUES.has(decl.value)) problems.push(`value is not a neutral workbench token: ${decl.prop}: ${decl.value}`);
        }
        const props = rule.decls.map((d) => d.prop).sort().join(',');
        if (props !== 'background-color,color') problems.push(`rule must pair exactly color and background-color: ${rule.selectors.join(', ')}`);
    }
    return problems;
}

// Every reason the route is not the proposed presentation. Never throws.
function verify(source, original) {
    const problems = [];
    for (const [name, , after] of ADDITIONS) {
        const n = count(source, after);
        if (n !== 1) problems.push(`missing presentation addition: ${name} (found ${n})`);
    }
    const styles = [...source.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/g)];
    if (styles.length !== 1) {
        problems.push(`expected exactly one inline <style>, found ${styles.length}`);
    } else {
        const [, attrs, inner] = styles[0];
        if (attrs.trim() !== '') problems.push(`<style> must carry no attributes, found "${attrs.trim()}"`);
        problems.push(...cssProblems(dedent(inner)));
        if (!/<\/script>\n\n {4}<style>[\s\S]*<\/style>\n\n<\/head>/.test(source)) problems.push('style is not placed after the page script, directly before </head>');
    }
    if (count(source, '<body') !== 1 || !source.includes('<body id="codes_search" class="oe-multi-code-selector">')) {
        problems.push('body must be exactly <body id="codes_search" class="oe-multi-code-selector">');
    }
    if (/<link\b/.test(source)) problems.push('new <link>: shared assets come from Header only');
    if (count(source, '<script') !== count(original, '<script')) problems.push('script element count changed');
    const uses = (text) => text.split('\n').filter((l) => l.startsWith('use ')).join('\n');
    if (uses(source) !== uses(original)) problems.push('PHP use imports changed');
    if (count(source, 'table-responsive') !== 1) problems.push('table-responsive must stay limited to the prohibition comment');
    for (const [name, snippet] of PRESERVED) {
        if (count(source, snippet) !== 1) problems.push(`preserved behaviour changed: ${name}`);
    }
    const restored = restore(source);
    if (restored === null) problems.push('cannot restore the original: presentation additions missing or duplicated');
    else if (restored !== original) problems.push(`restored route differs from the original at ${firstDifference(restored, original)}`);
    return problems;
}

function tokens() {
    const css = read(POPUP_CSS);
    const block = css.match(/html\.oe-workbench-context,\s*body\.workbench-active > \.dialogModal\s*\{([^}]*)\}/);
    if (!block) return null;
    return Object.fromEntries([...block[1].matchAll(/(--oe-wb-[\w-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)].map((m) => [m[1], m[2]]));
}

function luminance(hex) {
    const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

const original = read(FIXTURE);
const synthetic = apply(original);

describe('fixture and synthetic proposed patch (portable)', () => {
    test('the fixture is the unchanged original of the current route', () => {
        const route = read(ROUTE);
        const back = restoreLenient(route);
        assert.equal(back, original, `fixture does not match the route: ${back === original ? '' : firstDifference(back, original)}`);
        for (const [name, before, after] of ADDITIONS) {
            assert.equal(count(original, before), 1, `fixture anchor ${name}`);
            assert.equal(count(original, after), 0, `fixture already carries ${name}`);
        }
    });

    test('the synthetic proposed patch satisfies the whole contract', () => {
        assert.deepEqual(verify(synthetic, original), []);
        assert.equal(restore(synthetic), original);
    });

    test('the pinned CSS nests selectors at 2 spaces and declarations at 4', () => {
        for (const line of EXPECTED_CSS.split('\n')) {
            if (line === '' || line === '@media screen {' || line === '}') continue;
            if (line.endsWith('{') || line === '  }') assert.match(line, /^ {2}\S/, line);
            else assert.match(line, /^ {4}[a-z-]+: [^;]+;$/, line);
        }
    });
});

describe('negative mutations of the synthetic patch (portable)', () => {
    const swap = (from, to, all = false) => ({ from, to, all });
    // Built before any assertion: [label, mutation].
    const MUTATIONS = [
        ['session bootstrap removed', swap("require_once('../../globals.php');\n", '')],
        ['session replaced', swap('$session = SessionWrapperFactory::getInstance()->getActiveSession();', '$session = null;')],
        ['ACL import added', swap('use OpenEMR\\Core\\Header;', 'use OpenEMR\\Common\\Acl\\AclMain;\nuse OpenEMR\\Core\\Header;')],
        ['CSRF token dropped', swap('CsrfUtils::collectCsrfToken(session: $session)', "''")],
        ['AJAX URL changed', swap('"find_code_dynamic_ajax.php?', '"find_code_ajax.php?')],
        ['code type parse changed', swap('split_csv_line($codetype)', "explode(',', $codetype)")],
        ['code type not sent', swap('"value": document.forms[0].form_code_type.value', '"value": ""')],
        ['Product option dropped', swap("echo \" <option value='PROD'\";\n", '')],
        ['selection becomes sticky', swap('oSelectedIDs[this.id] = oSelectedIDs[this.id] ? 0 : 1;', 'oSelectedIDs[this.id] = 1;')],
        ['selection weight replaced by class', swap("row.style.fontWeight = oSelectedIDs[row.id] ? 'bold' : 'normal';", "row.classList.toggle('selected', !!oSelectedIDs[row.id]);")],
        ['callback loses description', swap("code[1], jobj['description']);", 'code[1]);')],
        ['OK no longer submits', swap("onclick='onOK()'", "onclick='dlgclose()'")],
        ['dialog no longer closes', swap('dlgclose()\n                return false;', 'return false;')],
        ['table id renamed', swap('id="my_data_table"', 'id="codes_table"')],
        ['body id renamed', swap('<body id="codes_search" class=', '<body id="codes" class=')],
        ['table-responsive wrapper', swap('            <table id="my_data_table"', '            <div class="table-responsive">\n            <table id="my_data_table"')],
        ['table-responsive class', swap('class="table table-sm"', 'class="table table-sm table-responsive"')],
        ['inactive control hidden', swap("<input type='checkbox' name='form_include_inactive'", "<input type='hidden' name='form_include_inactive'")],
        ['new listener', swap("            oTable.on('mouseover', 'tr', function () {", "            oTable.on('keydown', 'tr', function () {});\n            oTable.on('mouseover', 'tr', function () {")],
        ['shared asset added', swap("'datatables-colreorder']);", "'datatables-colreorder', 'workbench-reminder-popup']);")],
        ['linked stylesheet added', swap('    </style>\n', '    </style>\n    <link rel="stylesheet" href="x.css">\n')],
        ['geometry added', swap('            background-color: var(--oe-wb-paper);\n', '            background-color: var(--oe-wb-paper);\n            width: 100%;\n')],
        ['font size added', swap('            background-color: var(--oe-wb-canvas);\n', '            background-color: var(--oe-wb-canvas);\n            font-size: 0.9rem;\n')],
        ['font family added', swap('            background-color: var(--oe-wb-canvas);\n', '            background-color: var(--oe-wb-canvas);\n            font-family: Arial, sans-serif;\n')],
        ['overflow added', swap('            background-color: var(--oe-wb-paper);\n', '            background-color: var(--oe-wb-paper);\n            overflow: auto;\n')],
        ['visibility hidden', swap('            background-color: var(--oe-wb-paper);\n', '            background-color: var(--oe-wb-paper);\n            visibility: hidden;\n')],
        ['pointer-events none', swap('            background-color: var(--oe-wb-paper);\n', '            background-color: var(--oe-wb-paper);\n            pointer-events: none;\n')],
        ['!important added', swap('color: var(--oe-wb-ink);\n            background-color: var(--oe-wb-canvas);', 'color: var(--oe-wb-ink) !important;\n            background-color: var(--oe-wb-canvas);')],
        ['print rendering changed', swap('@media screen {', '@media print {')],
        ['screen and print', swap('@media screen {', '@media screen, print {')],
        ['media attribute on style', swap('    <style>\n', '    <style media="screen">\n')],
        ['context leak: bare body id', swap(GATE, 'body#codes_search', true)],
        ['context leak: no workbench class', swap(GATE, 'html body#codes_search.oe-multi-code-selector', true)],
        ['gate moved to popup class', swap(GATE, 'html.oe-workbench-popup body#codes_search.oe-multi-code-selector', true)],
        ['semantic overpaint: cells', swap(' #my_data_table {', ' #my_data_table td {')],
        ['semantic overpaint: alert', swap(' #my_data_table {', ' .alert-warning {')],
        ['extra wrapper selector', swap(' #my_data_table {', ' #my_data_table, .dataTables_wrapper {')],
        ['canvas and paper swapped', swap('var(--oe-wb-canvas);', 'var(--oe-wb-paper);')],
        ['hard-coded colour', swap('background-color: var(--oe-wb-paper);', 'background-color: #fff;')],
        ['selector indent drifted', swap('          html.oe-workbench-context body#codes_search.oe-multi-code-selector #my_data_table {', '            html.oe-workbench-context body#codes_search.oe-multi-code-selector #my_data_table {')],
        ['declaration indent drifted', swap('            color: var(--oe-wb-ink);\n            background-color: var(--oe-wb-paper);', '              color: var(--oe-wb-ink);\n            background-color: var(--oe-wb-paper);')],
        ['stray class on table', swap('class="table table-sm"', 'class="table table-sm oe-codes"')],
    ];
    const mutants = MUTATIONS.map(([label, { from, to, all }]) => {
        const anchors = count(synthetic, from);
        const text = all ? synthetic.split(from).join(to) : synthetic.replace(from, () => to);
        return { label, anchors, all, text };
    });

    test('every mutation anchor exists in the synthetic patch', () => {
        for (const { label, anchors, all } of mutants) {
            if (all) assert.ok(anchors >= 1, label);
            else assert.equal(anchors, 1, label);
        }
    });

    for (const { label, text } of mutants) {
        test(`rejected: ${label}`, () => {
            assert.notEqual(text, synthetic, `${label} did not change the source`);
            assert.ok(verify(text, original).length > 0, `${label} passed the contract`);
        });
    }
});

describe('shared assets and tokens the seam relies on (portable)', () => {
    test('Header autoloads the shared popup engine and stylesheet', () => {
        assert.match(read('config/config.yaml'), /\n {2}workbench-popup:\n {4}basePath: '%webroot%\/interface\/clinical-workspace\/'\n {4}script: popup\.js\n {4}link: popup\.css\n {4}autoload: true\n/);
        assert.equal(count(original, 'no_workbench-popup'), 0);
        assert.equal(count(original, 'Header::setupHeader('), 1);
    });

    test('the gate tokens exist under html.oe-workbench-context and pair at >= 4.5:1 (declared values only)', () => {
        const map = tokens();
        assert.ok(map, 'popup.css token block not found');
        for (const name of ['--oe-wb-ink', '--oe-wb-canvas', '--oe-wb-paper']) assert.match(map[name] ?? '', /^#/, name);
        assert.ok(contrast(map['--oe-wb-ink'], map['--oe-wb-canvas']) >= 4.5, 'ink on canvas');
        assert.ok(contrast(map['--oe-wb-ink'], map['--oe-wb-paper']) >= 4.5, 'ink on paper');
        assert.notEqual(map['--oe-wb-canvas'], map['--oe-wb-paper'], 'canvas and paper must differ for the sheet to read');
    });
});

// SYNTHETIC, NOT NATIVE. popup.js runs unmodified inside node:vm; the windows,
// documents, class lists and MutationObserver below are minimal stand-ins.
describe('shared popup.js activation in a synthetic parent context (portable)', () => {
    const ORIGIN = 'https://emr.test';
    const SHELL_ROOT = '#mainBox [data-workbench-mode]';
    const popupSource = read(POPUP_JS);

    function element(doc, { id = '', classes = [] } = {}) {
        const set = new Set(classes);
        const el = { ownerDocument: doc, id, observers: [] };
        const notify = () => el.observers.forEach((o) => o.schedule());
        el.classList = {
            add: (...names) => { const before = set.size; names.forEach((n) => set.add(n)); if (set.size !== before) notify(); },
            remove: (...names) => { let changed = false; names.forEach((n) => { changed = set.delete(n) || changed; }); if (changed) notify(); },
            contains: (name) => set.has(name),
            values: () => [...set],
        };
        return el;
    }

    function makeWindow({ origin = ORIGIN, parent, opener = null, frameElement = null, body = {}, shellRoot = false } = {}) {
        const win = { closed: false, location: { origin }, opener, frameElement, listeners: {}, unexpected: [] };
        const doc = {
            readyState: 'complete',
            defaultView: win,
            listeners: {},
            querySelector(selector) {
                if (selector !== SHELL_ROOT) win.unexpected.push(selector);
                return shellRoot && selector === SHELL_ROOT ? {} : null;
            },
            addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
            removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); },
        };
        doc.documentElement = element(doc);
        doc.body = element(doc, body);
        win.document = doc;
        win.parent = parent || win;
        win.addEventListener = (type, fn) => { (win.listeners[type] ||= []).push(fn); };
        win.removeEventListener = (type, fn) => { win.listeners[type] = (win.listeners[type] || []).filter((f) => f !== fn); };
        win.dispatch = (type, event = {}) => (win.listeners[type] || []).slice().forEach((fn) => fn(event));
        win.MutationObserver = class {
            constructor(callback) { this.callback = callback; this.targets = []; this.pending = false; }
            observe(target, options) {
                // The popup runs in a separate VM realm, so deepEqual would compare cross-realm prototypes.
                assert.strictEqual(options.attributes, true);
                assert.deepEqual(Array.from(options.attributeFilter), ['class']);
                target.observers.push(this);
                this.targets.push(target);
            }
            disconnect() { this.targets.forEach((t) => { t.observers = t.observers.filter((o) => o !== this); }); this.targets = []; }
            schedule() {
                if (this.pending) return;
                this.pending = true;
                queueMicrotask(() => { this.pending = false; if (this.targets.length) this.callback([], this); });
            }
        };
        return win;
    }

    const dialogFrame = { closest: (selector) => (selector === '.dialogModal' ? {} : null) };
    const tabFrame = { closest: () => null };
    const shell = (active) => makeWindow({ shellRoot: true, body: { classes: active ? ['workbench-active'] : [] } });
    const selectorBody = { id: 'codes_search', classes: ['oe-multi-code-selector'] };
    const boot = (win) => {
        win.window = win;
        vm.runInContext(popupSource, vm.createContext(win), { filename: POPUP_JS });
        return win;
    };
    const htmlClasses = (win) => win.document.documentElement.classList.values().sort();
    const gateMatches = (win) => win.document.documentElement.classList.contains('oe-workbench-context')
        && win.document.body.id === 'codes_search' && win.document.body.classList.contains('oe-multi-code-selector');
    const flush = () => new Promise((resolve) => setImmediate(resolve));

    test('dlgopen frame on the active shell: context and popup classes, gate matches', () => {
        const top = shell(true);
        const child = boot(makeWindow({ parent: top, frameElement: dialogFrame, body: selectorBody }));
        assert.deepEqual(htmlClasses(child), ['oe-workbench-context', 'oe-workbench-popup']);
        assert.equal(gateMatches(child), true);
        assert.deepEqual(child.unexpected, []);
    });

    test('nested under the issue editor dialog (add_edit_issue.php onAddCode)', () => {
        const top = shell(true);
        const issue = makeWindow({ parent: top, frameElement: dialogFrame });
        const child = boot(makeWindow({ parent: issue, frameElement: dialogFrame, body: selectorBody }));
        assert.equal(gateMatches(child), true);
        assert.ok(htmlClasses(child).includes('oe-workbench-popup'));
    });

    test('opened as a window from a prescription tab frame (general_edit onAddCode fallback)', () => {
        const top = shell(true);
        const tab = makeWindow({ parent: top, frameElement: tabFrame });
        const child = boot(makeWindow({ opener: tab, body: selectorBody }));
        assert.equal(gateMatches(child), true);
    });

    test('legacy shell: inert; follows activation, then legacy removal', async () => {
        const top = shell(false);
        const child = boot(makeWindow({ parent: top, frameElement: dialogFrame, body: selectorBody }));
        assert.deepEqual(htmlClasses(child), []);
        assert.equal(gateMatches(child), false);

        top.document.body.classList.add('workbench-active');
        await flush();
        assert.equal(gateMatches(child), true);

        top.document.body.classList.remove('workbench-active');
        await flush();
        assert.deepEqual(htmlClasses(child), []);
        assert.equal(gateMatches(child), false);
    });

    test('pagehide disposes owned classes and stops observing', async () => {
        const top = shell(true);
        const child = boot(makeWindow({ parent: top, frameElement: dialogFrame, body: selectorBody }));
        child.dispatch('pagehide', { persisted: false });
        assert.deepEqual(htmlClasses(child), []);
        top.document.body.classList.remove('workbench-active');
        top.document.body.classList.add('workbench-active');
        await flush();
        assert.deepEqual(htmlClasses(child), []);
    });

    test('a cross-origin parent is never trusted', () => {
        const foreign = makeWindow({ origin: 'https://other.test', shellRoot: true, body: { classes: ['workbench-active'] } });
        const child = boot(makeWindow({ parent: foreign, frameElement: dialogFrame, body: selectorBody }));
        assert.equal(gateMatches(child), false);
    });

    test('activation leaves body attributes, opener callback and dlgclose untouched', () => {
        const top = shell(true);
        const OnCodeSelected = () => { throw new Error('callback must not run'); };
        const tab = makeWindow({ parent: top, frameElement: tabFrame });
        tab.OnCodeSelected = OnCodeSelected;
        const child = makeWindow({ opener: tab, body: selectorBody });
        let closed = 0;
        child.dlgclose = () => { closed++; };
        boot(child);
        assert.equal(child.document.body.id, 'codes_search');
        assert.deepEqual(child.document.body.classList.values(), ['oe-multi-code-selector']);
        assert.equal(child.opener.OnCodeSelected, OnCodeSelected);
        assert.equal(closed, 0);
    });
});

describe('production route (portable)', () => {
    test('select_codes.php carries exactly the proposed presentation and nothing else', () => {
        assert.deepEqual(verify(read(ROUTE), original), []);
    });
});

if (HISTORY) {
    describe('history against the full base commit (--history, mandatory before merge)', () => {
        const git = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

        test('the base commit resolves and is an ancestor of HEAD', () => {
            const rev = git(['rev-parse', '--verify', `${BASE}^{commit}`]);
            assert.equal(rev.error, undefined, 'git is not available');
            assert.equal(rev.status, 0, rev.stderr);
            assert.equal(rev.stdout.trim(), BASE);
            assert.equal(git(['merge-base', '--is-ancestor', BASE, 'HEAD']).status, 0, 'HEAD does not descend from the base');
        });

        test('the fixture and the restored route equal the route at the base commit', () => {
            const shown = git(['show', `${BASE}:${ROUTE}`]);
            assert.equal(shown.status, 0, shown.stderr);
            assert.equal(original, shown.stdout, 'fixture differs from the base route');
            assert.equal(restore(read(ROUTE)), shown.stdout, 'restored route differs from the base route');
        });

        test('changes since the base are confined to the five intended files', () => {
            assert.equal(ALLOWLIST.length, 5);
            const diff = git(['diff', '--name-only', BASE, '--']);
            const untracked = git(['ls-files', '--others', '--exclude-standard']);
            assert.equal(diff.status, 0, diff.stderr);
            assert.equal(untracked.status, 0, untracked.stderr);
            const changed = [...new Set([...diff.stdout.split('\n'), ...untracked.stdout.split('\n')].map((l) => l.trim()).filter(Boolean))].sort();
            assert.deepEqual(changed.filter((file) => !ALLOWLIST.includes(file)), [], 'files outside the allowlist changed');
            assert.deepEqual(changed, [...ALLOWLIST].sort(), 'not every intended file is present');
        });
    });
}
