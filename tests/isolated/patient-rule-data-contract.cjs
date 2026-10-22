'use strict';
/*
 * OPEMR-71 patient rule data screen (interface/patient_file/rules/patient_data.php).
 *
 * Dependency-free node:test contract. Node built-ins only: no jsdom, postcss or yaml.
 *
 *   Portable:  node tests/isolated/patient-rule-data-contract.cjs
 *   History:   node tests/isolated/patient-rule-data-contract.cjs --history
 *              Explicit flag only. Needs git and the full pinned base commit, and fails
 *              rather than skips when either is missing. Mandatory before merge.
 *
 * The production route may differ from the fixture only by the two additions in
 * ADDITIONS. Undoing exactly those, once each, must reproduce the fixture byte for byte;
 * verify() enforces that itself, so any unrelated mutation of the route is rejected.
 *
 * Scope: a partial sheet backdrop (canvas body, paper form) inside an active workbench.
 * Not research fidelity and not native contrast acceptance. Nothing targets inputs, so
 * the inline red invalid-date background set by validate() stays effective.
 *
 * Known and deliberately unresolved here: the entryID SELECT and the edit UPDATE have no
 * pid predicate. This slice must neither execute the route nor fix that; the contract
 * pins the queries unchanged so the issue stays visible for a separate security change.
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
const ROUTE = 'interface/patient_file/rules/patient_data.php';
const FIXTURE = 'tests/fixtures/patient-rule-data-original.php.txt';
const POPUP_JS = 'interface/clinical-workspace/popup.js';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const CALLER_WIDGET = 'library/clinical_rules.php';
const CALLER_PAGE = 'interface/patient_file/summary/demographics.php';
const DIALOG_JS = 'library/dialog.js';
const HEADER_PHP = 'src/Core/Header.php';
const CONFIG_YAML = 'config/config.yaml';
const BASE = '18647270e0c799189d2dc10f801e8de2bff1a360';
const HISTORY = process.argv.includes('--history');
const ALLOWLIST = [
    ROUTE,
    FIXTURE,
    'tests/isolated/patient-rule-data-contract.cjs',
    'tests/js/patient-rule-data.test.js',
    'docs/clinical-ui/PATIENT-RULE-DATA.md',
];

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const count = (text, part) => text.split(part).length - 1;

const GATE = 'html.oe-workbench-context body.oe-rule-patient-data';
const BODY_ORIGINAL = '<body class="body_top">';
const BODY_PRESENTED = '<body class="body_top oe-rule-patient-data">';

// The CSS exactly as it sits between <style> and </style>: @media at column zero,
// selectors at 2 spaces, declarations at 4, one blank line between the rules.
const EXPECTED_CSS = [
    '@media screen {',
    `  ${GATE} {`,
    '    color: var(--oe-wb-ink, #17343b);',
    '    background-color: var(--oe-wb-canvas, #f3f7f5) !important;',
    '  }',
    '',
    `  ${GATE} > form {`,
    '    color: var(--oe-wb-ink, #17343b);',
    '    background-color: var(--oe-wb-paper, #fff);',
    '  }',
    '}',
].join('\n');

// The whole addition, with the four-space head embedding prefix on the tags only.
const STYLE_BLOCK = `    <style>\n${EXPECTED_CSS}\n    </style>\n`;

// [name, original, presented]. Nothing else may change in the route.
const ADDITIONS = [
    ['screen style immediately before </head>', '</script>\n</head>\n', `</script>\n${STYLE_BLOCK}</head>\n`],
    ['body marker class', BODY_ORIGINAL, BODY_PRESENTED],
];

// [rule selector, property, value, important] in source order.
const EXPECTED_DECLS = [
    [GATE, 'color', 'var(--oe-wb-ink, #17343b)', false],
    // !important is required: the existing .body_top theme background is itself important.
    [GATE, 'background-color', 'var(--oe-wb-canvas, #f3f7f5)', true],
    [`${GATE} > form`, 'color', 'var(--oe-wb-ink, #17343b)', false],
    [`${GATE} > form`, 'background-color', 'var(--oe-wb-paper, #fff)', false],
];

// Behaviour the presentation must not touch: [name, snippet, expected count].
const PRESERVED = [
    ['globals bootstrap', 'require_once("../../globals.php");', 1],
    ['active session', '$session = \\OpenEMR\\Common\\Session\\SessionWrapperFactory::getInstance()->getActiveSession();', 1],
    ['pid from session', "$pid = $session->get('pid', 0);", 1],
    ['Header assets', "<?php Header::setupHeader(['datetime-picker', 'opener', 'common']); ?>", 1],
    ['ACL gate', "if (!AclMain::aclCheckCore('patients', 'med')) {", 1],
    ['CSRF check on save', 'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', 1],
    ['CSRF token field', '<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />', 1],
    ['insert with pid', '"VALUES (?,?,?,?,?,?)", [$form_date, $pid, $form_category, $form_item, $form_complete, $form_result]);', 1],
    // Unresolved security issue, retained on purpose: no pid predicate on update.
    ['update by id only (known issue)', '"WHERE `id`=?", [$form_date,$form_complete,$form_result,$form_entryID]);', 1],
    // Unresolved security issue, retained on purpose: no pid predicate on entry read.
    ['entry read by id only (known issue)', '"WHERE `id`=?", [$entryID]);', 1],
    ['history list scoped by pid', '"WHERE `category`=? AND `item`=? AND `pid`=? " .', 1],
    ['inline red invalid date', 'f.form_date.style.backgroundColor="red";', 2],
    ['submit after validation', ' if (validate(f)) {\n  top.restoreSession();\n  f.submit();\n }', 1],
    ['cancel closes dialog', '$("#cancel").click(function() {\n      dlgclose();\n  });', 1],
    ['post-save dialog close', 'echo " dlgclose();\\n";', 1],
    ['post-save session restore', 'echo " top.restoreSession();\\n";', 1],
    ['datetime picker', "$('.datetimepicker').datetimepicker({", 1],
    ['picker shows seconds', '<?php $datetimepicker_showseconds = true; ?>', 1],
    ['picker timepicker', '<?php $datetimepicker_timepicker = true; ?>', 1],
    ['save control', '<a href="javascript:submitme();" class="btn btn-primary">', 1],
    ['cancel control', '<a href="#" id="cancel" class="btn btn-secondary">', 1],
    ['form element', "<form action='patient_data.php' name='patient_data' method='post' onsubmit='return top.restoreSession()'>", 1],
    ['date input', "echo \"<input type='text' size='16' class='datetimepicker' name='form_date' id='form_date' \" .", 1],
    ['date value escaped', "\"value='\" . attr($form_date ?? '') . \"' \" .", 1],
    ['completed select', "generate_form_field(['data_type' => 1,'field_id' => 'complete','list_id' => 'yesno','empty_title' => 'SKIP'], ($form_complete ?? null) ?: \"YES\");", 1],
    ['result escaped', "echo attr($form_result ?? '');", 1],
    ['edit link escaped', "attr_url($row['id']) .", 1],
    ['date cell escaped', "echo \"<td>\" . text($row['date']) . \"</td>\";", 1],
    ['result cell escaped', "echo \"<td>\" . nl2br(text($row['result'])) . \"</td>\";", 1],
    ['history table', '<table class="showborder" cellspacing="0px" cellpadding="2px">', 1],
    ['selected row highlight', "echo \"<tr class='text' style='background-color:LightGrey'>\";", 1],
    ['title span', '<td><span class="title">', 1],
];

const ALLOWED_SUFFIXES = new Set(['', ' > form']);
const FORBIDDEN_PROP = /^(font|width|height|min-|max-|margin|padding|display|position|top|left|right|bottom|overflow|visibility|pointer-events|opacity|z-index|transform|transition|border|outline|box-shadow|cursor|line-height|letter-spacing|text-|white-space|float|flex|grid|gap|background-image|background$)/;
const FORBIDDEN_TARGET = /\b(input|select|textarea|button|a|td|th|tr|table|tbody|span|label|p|div|hr|br)\b|[.#:[]/;

function apply(text) {
    let out = text;
    for (const [name, before, after] of ADDITIONS) {
        if (count(out, before) !== 1) throw new Error(`fixture anchor not unique: ${name}`);
        out = out.replace(before, () => after);
    }
    return out;
}

// Undo each addition exactly once; null when any is missing or duplicated.
function restore(text) {
    let out = text;
    for (const [, before, after] of ADDITIONS) {
        if (count(out, after) !== 1) return null;
        out = out.replace(after, () => before);
    }
    return out;
}

// Undo whichever additions are present (fixture authentication only).
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

function cssProblems(inner) {
    const problems = [];
    const expectedInner = `\n${EXPECTED_CSS}\n    `;
    if (inner !== expectedInner) problems.push(`style body differs from the pinned literal at ${firstDifference(inner, expectedInner)}`);
    let tree;
    try {
        tree = parseCss(inner);
    } catch (error) {
        return [...problems, `style body does not parse: ${error.message}`];
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
    const decls = [];
    for (const rule of rules) {
        if (rule.selectors.length !== 1) problems.push(`selector list instead of one selector: ${rule.selectors.join(', ')}`);
        for (const selector of rule.selectors) {
            if (selector !== GATE && !selector.startsWith(`${GATE} `)) {
                problems.push(`selector escapes the workbench context gate: ${selector}`);
                continue;
            }
            const suffix = selector.slice(GATE.length);
            if (!ALLOWED_SUFFIXES.has(suffix)) problems.push(`unexpected target: ${selector}`);
            if (FORBIDDEN_TARGET.test(suffix.replace(/^ > form$/, ''))) problems.push(`selector reaches a control, cell or semantic class: ${selector}`);
        }
        for (const decl of rule.decls) {
            if (FORBIDDEN_PROP.test(decl.prop)) problems.push(`geometry, font, visibility or wrapper property: ${decl.prop}`);
            decls.push([rule.selectors.join(', '), decl.prop, decl.value, decl.important]);
        }
    }
    if (JSON.stringify(decls) !== JSON.stringify(EXPECTED_DECLS)) {
        problems.push(`declarations are not the two paired palette rules: ${JSON.stringify(decls)}`);
    }
    return problems;
}

// Every reason the route is not exactly the proposed presentation. Never throws.
function verify(source, original) {
    const problems = [];
    for (const [name, , after] of ADDITIONS) {
        const n = count(source, after);
        if (n !== 1) problems.push(`missing or repeated presentation addition: ${name} (found ${n})`);
    }
    const styles = [...source.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/g)];
    if (styles.length !== 1) {
        problems.push(`expected exactly one inline <style>, found ${styles.length}`);
    } else {
        const [, attrs, inner] = styles[0];
        if (attrs !== '') problems.push(`<style> must carry no attributes, found "${attrs}"`);
        problems.push(...cssProblems(inner));
        if (!source.includes(`</script>\n${STYLE_BLOCK}</head>\n`)) problems.push('style is not the four-space-embedded block directly after the page script and before </head>');
    }
    if (count(source, BODY_PRESENTED) !== 1 || count(source, BODY_ORIGINAL) !== 0) problems.push(`body must be exactly ${BODY_PRESENTED}`);
    if (count(source, '<body') !== count(original, '<body')) problems.push('body element count changed');
    if (count(source, '<form') !== 1 || count(source, '</form>') !== 1) problems.push('form must stay the single unwrapped form');
    if (count(source, '<link') !== count(original, '<link')) problems.push('new <link>: shared assets come from Header only');
    if (count(source, '<script') !== count(original, '<script')) problems.push('script element count changed');
    const uses = (text) => text.split('\n').filter((l) => l.startsWith('use ')).join('\n');
    if (uses(source) !== uses(original)) problems.push('PHP use imports changed');
    for (const [name, snippet, expected] of PRESERVED) {
        if (count(source, snippet) !== expected) problems.push(`preserved behaviour changed: ${name}`);
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
    test('the fixture is the unchanged original of the current route, with unique anchors', () => {
        const route = read(ROUTE);
        const back = restoreLenient(route);
        assert.equal(back, original, `fixture does not match the route: ${back === original ? '' : firstDifference(back, original)}`);
        for (const [name, before, after] of ADDITIONS) {
            assert.equal(count(original, before), 1, `fixture anchor ${name}`);
            assert.equal(count(original, after), 0, `fixture already carries ${name}`);
        }
        assert.equal(count(original, '<style'), 0, 'original route has no inline style');
        assert.equal(count(original, 'oe-rule-patient-data'), 0, 'original route has no marker class');
        for (const [name, snippet, expected] of PRESERVED) assert.equal(count(original, snippet), expected, `fixture preserved snippet: ${name}`);
    });

    test('the synthetic proposed patch satisfies the whole contract and restores exactly', () => {
        assert.deepEqual(verify(synthetic, original), []);
        assert.equal(restore(synthetic), original);
    });

    test('the pinned style literal is lint-shaped: column-zero @media, 2-space selectors, 4-space declarations', () => {
        const lines = STYLE_BLOCK.split('\n');
        assert.equal(lines[0], '    <style>');
        assert.equal(lines[lines.length - 2], '    </style>');
        assert.equal(lines[lines.length - 1], '');
        for (const line of EXPECTED_CSS.split('\n')) {
            if (line === '' || line === '@media screen {' || line === '}') continue;
            if (line.endsWith('{') || line === '  }') assert.match(line, /^ {2}\S/, line);
            else assert.match(line, /^ {4}[a-z-]+: [^;]+;$/, line);
        }
        assert.equal(count(EXPECTED_CSS, '\n\n'), 1, 'exactly one blank line, between the two rules');
        assert.equal(count(EXPECTED_CSS, '!important'), 1, 'only the canvas background is important');
    });

    test('an unrelated original mutation is rejected by verify() itself, not only by a separate fixture test', () => {
        const mutated = synthetic.replace('// Display the form\n', () => '// Display the form.\n');
        assert.notEqual(mutated, synthetic);
        const problems = verify(mutated, original);
        assert.ok(problems.some((p) => p.startsWith('restored route differs')), problems.join('\n'));
    });

    test('the pid-less entryID read and update remain unresolved and untouched by this slice', () => {
        for (const text of [original, synthetic]) {
            assert.equal(count(text, 'sqlStatement("UPDATE `rule_patient_data` " .\n        "SET `date`=?, `complete`=?, `result`=? " .\n        "WHERE `id`=?", [$form_date,$form_complete,$form_result,$form_entryID]);'), 1);
            assert.equal(count(text, '$selectedEntry = sqlQuery("SELECT `date`, `complete`, `result` " .\n    "FROM `rule_patient_data` " .\n    "WHERE `id`=?", [$entryID]);'), 1);
            assert.equal(count(text, '`pid`=?'), 1, 'only the history list query is pid scoped');
        }
    });
});

describe('negative mutations of the synthetic patch (portable)', () => {
    const swap = (from, to, all = false) => ({ from, to, all });
    const sheetRule = `  ${GATE} > form {`;
    const thirdRule = `  }\n\n  ${GATE} #form_date {\n    background-color: var(--oe-wb-paper, #fff);\n  }\n}\n    </style>`;
    // Built before any assertion: [label, ...steps]. Each non-`all` step must match once.
    const MUTATIONS = [
        ['context gate removed from canvas rule', swap(`  ${GATE} {`, '  body.oe-rule-patient-data {')],
        ['context gate removed everywhere', swap(GATE, 'body.oe-rule-patient-data', true)],
        ['gate moved to popup class', swap('html.oe-workbench-context', 'html.oe-workbench-popup', true)],
        ['print media', swap('@media screen {', '@media print {')],
        ['all media', swap('@media screen {', '@media all {')],
        ['screen and print', swap('@media screen {', '@media screen, print {')],
        ['media query dropped', swap('    <style>\n@media screen {\n', '    <style>\n'), swap('  }\n}\n    </style>', '  }\n    </style>')],
        ['media attribute on style', swap('    <style>\n', '    <style media="screen">\n')],
        ['extra selector in list', swap(sheetRule, `  ${GATE} > form, ${GATE} table {`)],
        ['extra third rule on the date input', swap('  }\n}\n    </style>', thirdRule)],
        ['input targeted', swap(sheetRule, `  ${GATE} > form input {`)],
        ['semantic overpaint: .required', swap(sheetRule, `  ${GATE} > form .required {`)],
        ['semantic overpaint: .showborder', swap(sheetRule, `  ${GATE} .showborder {`)],
        ['descendant instead of child form', swap(sheetRule, `  ${GATE} form {`)],
        ['extra property', swap('    background-color: var(--oe-wb-paper, #fff);\n', '    background-color: var(--oe-wb-paper, #fff);\n    border-color: var(--oe-wb-line);\n')],
        ['extra !important on paper', swap('var(--oe-wb-paper, #fff);', 'var(--oe-wb-paper, #fff) !important;')],
        ['extra !important on ink', swap('    color: var(--oe-wb-ink, #17343b);\n    background-color: var(--oe-wb-canvas', '    color: var(--oe-wb-ink, #17343b) !important;\n    background-color: var(--oe-wb-canvas')],
        ['required canvas !important dropped', swap('var(--oe-wb-canvas, #f3f7f5) !important;', 'var(--oe-wb-canvas, #f3f7f5);')],
        ['canvas and paper swapped', swap('var(--oe-wb-canvas, #f3f7f5)', 'var(--oe-wb-paper, #fff)')],
        ['fallback colour changed', swap('#17343b);\n    background-color: var(--oe-wb-paper', '#000);\n    background-color: var(--oe-wb-paper')],
        ['hard-coded colour', swap('var(--oe-wb-paper, #fff);', '#fff;')],
        ['padding added', swap('    background-color: var(--oe-wb-paper, #fff);\n', '    background-color: var(--oe-wb-paper, #fff);\n    padding: 1rem;\n')],
        ['width added', swap('    background-color: var(--oe-wb-paper, #fff);\n', '    background-color: var(--oe-wb-paper, #fff);\n    max-width: 40rem;\n')],
        ['font added', swap('    background-color: var(--oe-wb-canvas, #f3f7f5) !important;\n', '    background-color: var(--oe-wb-canvas, #f3f7f5) !important;\n    font-family: Arial, sans-serif;\n')],
        ['wrapper around form', swap("<form action='patient_data.php'", "<div class=\"oe-rule-sheet\">\n<form action='patient_data.php'"), swap('</form>\n', '</form>\n</div>\n')],
        ['class added to form', swap("<form action='patient_data.php' name='patient_data'", "<form class='oe-sheet' action='patient_data.php' name='patient_data'")],
        ['style block duplicated', swap(`${STYLE_BLOCK}</head>`, `${STYLE_BLOCK}${STYLE_BLOCK}</head>`)],
        ['style block relocated into body', swap(`</script>\n${STYLE_BLOCK}</head>\n`, '</script>\n</head>\n'), swap(`${BODY_PRESENTED}\n`, `${BODY_PRESENTED}\n${STYLE_BLOCK}`)],
        ['style placed before the page script', swap(`</script>\n${STYLE_BLOCK}</head>\n`, '</script>\n</head>\n'), swap('\n<script>\n\nfunction validate', `\n${STYLE_BLOCK}<script>\n\nfunction validate`)],
        ['body marker corrupted', swap(BODY_PRESENTED, '<body class="body_top oe-rule-patient_data">')],
        ['body marker dropped, legacy class kept', swap(BODY_PRESENTED, BODY_ORIGINAL)],
        ['body_top class dropped', swap(BODY_PRESENTED, '<body class="oe-rule-patient-data">')],
        ['css marker corrupted', swap(`  ${GATE} {`, '  html.oe-workbench-context body.oe-rule-patient-date {')],
        ['style attribute added', swap('    <style>\n', '    <style type="text/css">\n')],
        ['closing tag indent drifted', swap('\n    </style>\n', '\n</style>\n')],
        ['selector indent drifted', swap(`\n${sheetRule}`, `\n  ${sheetRule}`)],
        ['declaration indent drifted', swap('    background-color: var(--oe-wb-paper, #fff);', '      background-color: var(--oe-wb-paper, #fff);')],
        ['blank line between rules removed', swap(`  }\n\n${sheetRule}`, `  }\n${sheetRule}`)],
        ['linked stylesheet added', swap('    </style>\n', '    </style>\n    <link rel="stylesheet" href="x.css">\n')],
        ['shared asset added', swap("'opener', 'common']); ?>", "'opener', 'common', 'workbench-reminder-popup']); ?>")],
        ['extra script added', swap('</script>\n    <style>', '</script>\n<script>window.x = 1;</script>\n    <style>')],
        ['first red invalid-date background removed', swap('    f.form_date.focus();\n    f.form_date.style.backgroundColor="red";\n    return false;\n  } else {', '    f.form_date.focus();\n    return false;\n  } else {')],
        ['future-date red background recoloured', swap('        f.form_date.style.backgroundColor="red";\n        return false;\n    }', '        f.form_date.style.backgroundColor="orange";\n        return false;\n    }')],
        ['pid source altered', swap("$pid = $session->get('pid', 0);", "$pid = $_GET['pid'] ?? 0;")],
        ['ACL weakened', swap("AclMain::aclCheckCore('patients', 'med')", "AclMain::aclCheckCore('patients', 'demo')")],
        ['CSRF check removed', swap('    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);\n', '')],
        ['CSRF token field emptied', swap('CsrfUtils::collectCsrfToken(session: $session)', "''")],
        ['history query unscoped from pid', swap('AND `item`=? AND `pid`=? " .', 'AND `item`=? " .')],
        ['out-of-scope pid fix applied to update', swap('"WHERE `id`=?", [$form_date,$form_complete,$form_result,$form_entryID]);', '"WHERE `id`=? AND `pid`=?", [$form_date,$form_complete,$form_result,$form_entryID,$pid]);')],
        ['result escaping dropped', swap("echo attr($form_result ?? '');", "echo $form_result ?? '';")],
        ['date cell escaping dropped', swap("text($row['date'])", "$row['date']")],
        ['cancel no longer closes', swap('$("#cancel").click(function() {\n      dlgclose();\n  });', '$("#cancel").click(function() {\n  });')],
        ['post-save close removed', swap('    echo " dlgclose();\\n";\n', '')],
        ['save no longer submits', swap('  f.submit();\n', '')],
        ['save control rewired', swap('href="javascript:submitme();"', 'href="#"')],
        ['form restoreSession dropped', swap("onsubmit='return top.restoreSession()'", "onsubmit='return true'")],
        ['picker seconds disabled', swap('<?php $datetimepicker_showseconds = true; ?>', '<?php $datetimepicker_showseconds = false; ?>')],
        ['date input class changed', swap("class='datetimepicker' name='form_date'", "class='form-control' name='form_date'")],
        ['save control restyled', swap('<a href="javascript:submitme();" class="btn btn-primary">', '<a href="javascript:submitme();" class="btn btn-success">')],
        ['cancel control renamed', swap('<a href="#" id="cancel" class="btn btn-secondary">', '<a href="#" id="close" class="btn btn-secondary">')],
        ['use import added', swap('use OpenEMR\\Core\\Header;', 'use OpenEMR\\Common\\Logging\\SystemLogger;\nuse OpenEMR\\Core\\Header;')],
        ['trailing newline added', swap('</body>\n</html>\n', '</body>\n</html>\n\n', true)],
    ];

    const mutants = MUTATIONS.map(([label, ...steps]) => {
        let text = synthetic;
        const anchors = [];
        for (const { from, to, all } of steps) {
            anchors.push({ n: count(text, from), all });
            text = all ? text.split(from).join(to) : text.replace(from, () => to);
        }
        return { label, anchors, text };
    });

    test('every mutation anchor exists in the synthetic patch and every mutant changes it', () => {
        for (const { label, anchors, text } of mutants) {
            for (const { n, all } of anchors) {
                if (all) assert.ok(n >= 1, label);
                else assert.equal(n, 1, label);
            }
            assert.notEqual(text, synthetic, `${label} did not change the source`);
        }
    });

    for (const { label, text } of mutants) {
        test(`rejected: ${label}`, () => {
            assert.notEqual(text, synthetic, `${label} did not change the source`);
            const problems = verify(text, original);
            assert.ok(problems.length > 0, `${label} passed the contract`);
        });
    }
});

describe('caller chain, shared assets and tokens (portable, source assertions only)', () => {
    test('clinical_rules.php links custom_flag reminders to this route as a medium_modal', () => {
        const widget = read(CALLER_WIDGET);
        const segment = widget.slice(widget.indexOf("if ($action['custom_flag']) {"), widget.indexOf("} elseif ($action['clin_rem_link']) {"));
        assert.ok(segment.length > 0, 'custom_flag branch not found');
        assert.ok(segment.includes('$url = "../rules/patient_data.php?category=" . attr_url($action[\'category\']);'));
        assert.ok(segment.includes('$url .= "&item=" . attr_url($action[\'item\']);'));
        assert.ok(segment.includes("echo \"<a href='\" . $url . \"' class='medium_modal' onclick='return top.restoreSession()'>\";"));
        // The relative link is resolved from the summary fragment's directory.
        assert.equal(path.posix.join(path.posix.dirname(CALLER_PAGE), '../rules/patient_data.php'), ROUTE);
        assert.equal(count(original, "$category = trim((string) $_GET['category']);"), 1);
        assert.equal(count(original, "$item = trim((string) $_GET['item']);"), 1);
    });

    test('demographics.php opens medium_modal links with dlgopen iframe 800x200, no resize, refresh on close', () => {
        const page = read(CALLER_PAGE);
        const start = page.indexOf('$(".medium_modal").on(\'click\', function (e) {');
        assert.ok(start > 0, 'medium_modal handler not found');
        const gate = page.lastIndexOf("getBoolean('enable_cdr') && OEGlobalsBag::getInstance()->getBoolean('enable_cdr_crw')", start);
        assert.ok(gate > 0 && start - gate < 400, 'handler is not inside the CDR reminders gate');
        const handler = page.slice(start, page.indexOf('$(".cdr-rule-btn-info-launch")', start));
        for (const part of [
            "dlgopen('', '', 800, 200, '', '', {",
            "onClosed: 'refreshme',",
            'allowResize: false,',
            'allowDrag: true,',
            "dialogId: 'demreminder',",
            "type: 'iframe',",
            "url: $(this).attr('href')",
        ]) {
            assert.ok(handler.includes(part), part);
        }
        assert.equal(count(handler, 'sizeHeight'), 0, 'caller keeps the default auto height');
    });

    test('dialog.js: iframe dialogs sit on top inside .dialogModal, auto height clamped to a 300px minimum', () => {
        const dialog = read(DIALOG_JS);
        for (const part of [
            "where = (opts.type === 'iframe') ? top : window;",
            "sizeHeight: 'auto', // 'full' will use as much height as allowed",
            "    if (height <= 300 && opts.type === 'iframe') {\n        height = 300;\n    }",
            'max-height: 94vh',
            '<div id="%id%" class="modal fade dialogModal" tabindex="-1" role="dialog">',
            '<iframe id="modalframe" class="modalIframe w-100 h-100 border-0" name="%winname%" %url%></iframe>',
        ]) {
            assert.ok(dialog.includes(part), part);
        }
        const auto = dialog.indexOf("if (opts.sizeHeight === 'auto' && opts.type === 'iframe') {");
        assert.ok(auto > 0, 'auto-height branch not found');
        assert.match(dialog.slice(auto), /^[^\n]*\n\s*SizeModaliFrame\(e, height\);/);
    });

    test('Header autoloads the shared popup engine via config.yaml; the route adds no asset', () => {
        const header = read(HEADER_PHP);
        assert.ok(header.includes('$output .= self::setupAssets(is_array($assets) ? $assets : [$assets], true);'));
        assert.ok(header.includes('$map = self::readConfigFile($projectDir . "/config/config.yaml");'));
        assert.match(read(CONFIG_YAML), /\n {2}workbench-popup:\n {4}basePath: '%webroot%\/interface\/clinical-workspace\/'\n {4}script: popup\.js\n {4}link: popup\.css\n {4}autoload: true\n/);
        for (const text of [original, synthetic]) {
            assert.equal(count(text, 'Header::setupHeader('), 1);
            assert.equal(count(text, 'no_workbench-popup'), 0);
            assert.equal(count(text, 'workbench-popup'), 0);
        }
    });

    test('fallbacks equal the shared tokens, which pair at >= 4.5:1 (declared values only)', () => {
        const map = tokens();
        assert.ok(map, 'popup.css token block not found');
        for (const [, name, fallback] of EXPECTED_CSS.matchAll(/var\((--oe-wb-[\w-]+), (#[0-9a-f]+)\)/g)) {
            assert.equal(map[name], fallback, `${name} fallback`);
        }
        assert.ok(contrast(map['--oe-wb-ink'], map['--oe-wb-canvas']) >= 4.5, 'ink on canvas');
        assert.ok(contrast(map['--oe-wb-ink'], map['--oe-wb-paper']) >= 4.5, 'ink on paper');
        assert.notEqual(map['--oe-wb-canvas'], map['--oe-wb-paper'], 'canvas and paper must differ for the sheet to read');
    });
});

// SYNTHETIC, NOT NATIVE. popup.js runs unmodified inside node:vm; the windows,
// documents, class lists and MutationObserver below are minimal stand-ins.
describe('shared popup.js activation for the demreminder dlgopen frame (portable)', () => {
    const ORIGIN = 'https://emr.test';
    const SHELL_ROOT = '#mainBox [data-workbench-mode]';
    const popupSource = read(POPUP_JS);

    function element(doc, { classes = [] } = {}) {
        const set = new Set(classes);
        const el = { ownerDocument: doc, observers: [] };
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
        const win = { closed: false, location: { origin }, opener, frameElement, listeners: {}, unexpected: [], observed: [] };
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
                // popup.js runs in another VM realm: compare scalars and Array.from copies,
                // never deepEqual on the options object (cross-realm prototypes differ).
                win.observed.push({ attributes: options.attributes, attributeFilter: Array.from(options.attributeFilter) });
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

    // dlgopen appends the iframe to top's body inside div.dialogModal (see dialog.js test).
    const dialogFrame = { closest: (selector) => (selector === '.dialogModal' ? {} : null) };
    const shell = (active) => makeWindow({ shellRoot: true, body: { classes: active ? ['workbench-active'] : [] } });
    const routeBody = () => ({ classes: ['body_top', 'oe-rule-patient-data'] });
    const boot = (win) => {
        win.window = win;
        vm.runInContext(popupSource, vm.createContext(win), { filename: POPUP_JS });
        return win;
    };
    const htmlClasses = (win) => win.document.documentElement.classList.values().sort();
    const gateMatches = (win) => win.document.documentElement.classList.contains('oe-workbench-context')
        && win.document.body.classList.contains('oe-rule-patient-data');
    const flush = () => new Promise((resolve) => setImmediate(resolve));

    test('demreminder frame on the active shell: context and popup classes, gate matches, shell body observed', () => {
        const top = shell(true);
        const child = boot(makeWindow({ parent: top, frameElement: dialogFrame, body: routeBody() }));
        assert.deepEqual(htmlClasses(child), ['oe-workbench-context', 'oe-workbench-popup']);
        assert.equal(gateMatches(child), true);
        assert.deepEqual(child.unexpected, []);
        // The observer is built from the observed body's own window: the shell.
        assert.equal(child.observed.length, 0);
        assert.equal(top.observed.length, 1);
        assert.strictEqual(top.observed[0].attributes, true);
        assert.deepEqual(top.observed[0].attributeFilter, ['class']);
    });

    test('edit link reloads inside the same frame: a fresh boot resolves the same way', () => {
        const top = shell(true);
        const first = boot(makeWindow({ parent: top, frameElement: dialogFrame, body: routeBody() }));
        first.dispatch('pagehide', { persisted: false });
        const second = boot(makeWindow({ parent: top, frameElement: dialogFrame, body: routeBody() }));
        assert.equal(gateMatches(second), true);
    });

    test('legacy shell: inert; follows activation, then legacy removal', async () => {
        const top = shell(false);
        const child = boot(makeWindow({ parent: top, frameElement: dialogFrame, body: routeBody() }));
        assert.deepEqual(htmlClasses(child), []);
        assert.equal(gateMatches(child), false);

        top.document.body.classList.add('workbench-active');
        await flush();
        assert.equal(gateMatches(child), true);
        assert.deepEqual(htmlClasses(child), ['oe-workbench-context', 'oe-workbench-popup']);

        top.document.body.classList.remove('workbench-active');
        await flush();
        assert.deepEqual(htmlClasses(child), []);
        assert.equal(gateMatches(child), false);
    });

    test('pagehide disposes owned classes and stops observing', async () => {
        const top = shell(true);
        const child = boot(makeWindow({ parent: top, frameElement: dialogFrame, body: routeBody() }));
        child.dispatch('pagehide', { persisted: false });
        assert.deepEqual(htmlClasses(child), []);
        top.document.body.classList.remove('workbench-active');
        top.document.body.classList.add('workbench-active');
        await flush();
        assert.deepEqual(htmlClasses(child), []);
    });

    test('a cross-origin parent is never trusted', () => {
        const foreign = makeWindow({ origin: 'https://other.test', shellRoot: true, body: { classes: ['workbench-active'] } });
        const child = boot(makeWindow({ parent: foreign, frameElement: dialogFrame, body: routeBody() }));
        assert.equal(gateMatches(child), false);
    });

    test('without the marker class the gate never matches, even in an active workbench', () => {
        const top = shell(true);
        const child = boot(makeWindow({ parent: top, frameElement: dialogFrame, body: { classes: ['body_top'] } }));
        assert.ok(htmlClasses(child).includes('oe-workbench-context'));
        assert.equal(gateMatches(child), false);
    });

    test('activation leaves body classes, refreshme callback and dlgclose untouched', async () => {
        const top = shell(true);
        let refreshed = 0;
        top.refreshme = () => { refreshed++; };
        const child = makeWindow({ parent: top, frameElement: dialogFrame, body: routeBody() });
        let closed = 0;
        child.dlgclose = () => { closed++; };
        boot(child);
        top.document.body.classList.remove('workbench-active');
        await flush();
        top.document.body.classList.add('workbench-active');
        await flush();
        assert.deepEqual(child.document.body.classList.values(), ['body_top', 'oe-rule-patient-data']);
        assert.equal(closed, 0);
        assert.equal(refreshed, 0);
    });
});

describe('production route (portable)', () => {
    test('the synthetic candidate passes first, then patient_data.php carries exactly the presentation', () => {
        assert.deepEqual(verify(synthetic, original), [], 'synthetic candidate must pass before the route is judged');
        assert.deepEqual(verify(read(ROUTE), original), []);
    });
});

if (HISTORY) {
    describe('history against the pinned base commit (--history, mandatory before merge)', () => {
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
            assert.equal(shown.error, undefined, 'git is not available');
            assert.equal(shown.status, 0, shown.stderr);
            assert.equal(original, shown.stdout, 'fixture differs from the base route');
            assert.equal(restore(read(ROUTE)), shown.stdout, 'restored route differs from the base route');
        });

        test('changes since the base are exactly the five intended files', () => {
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
