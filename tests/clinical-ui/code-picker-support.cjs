'use strict';

// Shared, dependency-free contract for the Code Finder popup presentation slice
// (interface/patient_file/encounter/find_code_popup.php). Source contracts only:
// native control geometry and effective rendered contrast are NOT proven here.
// No content hashes: exact byte comparison against the baseline lives in the
// explicit-history suite (code-picker-baseline.test.cjs), which uses `git show`.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const BASELINE_COMMIT = '18647270e0c799189d2dc10f801e8de2bff1a360';

const ROUTE = 'interface/patient_file/encounter/find_code_popup.php';
const ASSETS = 'src/Common/Assets/ClinicalWorkspaceAssets.php';
const CSS = 'interface/clinical-workspace/code-picker-popup.css';

const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const count = (text, part) => text.split(part).length - 1;

// ---- Declared route presentation additions: [original, planned].

const LINK = '    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>'
    + '/interface/clinical-workspace/code-picker-popup.css?v=<?php echo attr_url($clinicalAssets->version(\'code-picker-popup.css\')); ?>">';
const BODY = '<body class="oe-code-picker-popup" onload="<?php echo $focus; ?>">';
const DOCUMENT_DIV = '<div class="container-fluid oe-code-picker-popup__document">';
const ROUTE_ADDITIONS = [
    [
        'use OpenEMR\\Common\\Csrf\\CsrfUtils;\n',
        'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\nuse OpenEMR\\Common\\Csrf\\CsrfUtils;\n',
    ],
    [
        "    <?php Header::setupHeader('opener'); ?>\n",
        "    <?php Header::setupHeader('opener'); ?>\n    <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>\n" + LINK + '\n',
    ],
    ['<body onload="<?php echo $focus; ?>">\n', `${BODY}\n`],
    ['    <div class="container-fluid">\n', `    ${DOCUMENT_DIV}\n`],
];
const ASSET_ADDITIONS = [
    ["        'calendar-workday.js',\n", "        'calendar-workday.js',\n        'code-picker-popup.css',\n"],
];

// Presentation markers that must not survive the declared inverse.
const PRESENTATION_MARKERS = ['ClinicalWorkspaceAssets', 'code-picker-popup', '$clinicalAssets'];

// Business anchors with their occurrence counts. The counts are validated against
// the immutable baseline by the explicit-history suite; the portable suite checks
// the working tree (and its declared inverse) carries the same counts.
const ROUTE_ANCHORS = [
    ['if (!empty($_POST)) {\n    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);\n}\n', 1],
    ['CsrfUtils::checkCsrfInput(', 1],
    ['<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />', 1],
    ['$res = main_code_set_search($allowed_codes, $search_term);', 1],
    ['main_code_set_search(', 1],
    ['while ($row = sqlFetchArray($res)) {', 2],
    ['if (opener.closed || !opener.set_related) {', 1],
    ['if (opener.closed || !opener.set_related_target) {', 1],
    ['// opener.set_related_target(codetype, code, selector, codedesc, target_element);', 1],
    ['var msg = opener.set_related(codetype, code, selector, codedesc);', 2],
    ['dlgclose();', 2],
    ['"onclick=\'return selcode(\\"PROD\\", " .', 1],
    ['"onclick=\'return selcode_target(" . attr_js($dynCodeType) .', 1],
    ['"onclick=\'return selcode(" . attr_js($dynCodeType) .', 1],
    [`<form class="form-inline" method='post' name='theform'`, 2],
    ['</form>', 1],
    ["<select class='form-control' name='form_code_type'>", 1],
    [`echo "<select class='form-control' name='form_code_type'";`, 1],
    [`<input type='text' class='form-control' name='search_term' id="searchTerm"`, 1],
    ["<button type='submit' class='btn btn-primary btn-search'", 1],
    ["<button type='button' class='btn btn-primary btn-delete' value=''", 1],
    ["<button type='button' class='btn btn-danger btn-delete' value=''\n                            onclick=\"selcode('', '', '', '')\"></button>\n", 1],
    ["<table class='table table-striped table-responsive-sm'>", 1],
    ["<th class='font-weight-bold'><?php echo xlt('Code'); ?></th>", 1],
    ["<th class='font-weight-bold'><?php echo xlt('Description'); ?></th>", 1],
    ['font-weight-bold', 2],
    ['$focus = "document.theform.search_term.select();";', 1],
    ["<?php Header::setupHeader('opener'); ?>", 1],
    ['style=', 0],
    ['<style', 0],
    ['font-size', 0],
];

function reverse(text, additions) {
    let restored = text;
    for (const [before, after] of additions) {
        if (count(restored, after) !== 1) {
            throw new Error(`planned addition must occur exactly once: ${JSON.stringify(after)}`);
        }
        restored = restored.replace(after, () => before);
    }
    return restored;
}

// Portable route contract: declared inverse is possible and strips every
// presentation marker; presentation additions are exact; business anchors keep
// their baseline counts both in the working tree and in the inverse.
function routeContractErrors(php) {
    const errors = [];
    let restored = null;
    try {
        restored = reverse(php, ROUTE_ADDITIONS);
    } catch (error) {
        errors.push(`inverse: ${error.message}`);
    }
    if (restored !== null) {
        for (const marker of PRESENTATION_MARKERS) {
            if (restored.includes(marker)) errors.push(`inverse retains presentation marker: ${marker}`);
        }
    }
    const exact = [
        ['use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;', 1],
        ['$clinicalAssets = new ClinicalWorkspaceAssets();', 1],
        [LINK, 1],
        ['code-picker-popup.css', 2],
        ['<link ', 1],
        [BODY, 1],
        [DOCUMENT_DIV, 1],
        ['container-fluid', 1],
        ['<body', 1],
    ];
    for (const [part, expected] of exact) {
        if (count(php, part) !== expected) errors.push(`presentation ${JSON.stringify(part)}: ${count(php, part)} != ${expected}`);
    }
    // Class tokens, not substrings: the document class shares the body class prefix.
    const tokens = (php.match(/\boe-code-picker-popup(?:__[\w-]+)?\b/g) || []).sort();
    if (JSON.stringify(tokens) !== JSON.stringify(['oe-code-picker-popup', 'oe-code-picker-popup__document'])) {
        errors.push(`popup class tokens: ${JSON.stringify(tokens)}`);
    }
    const header = php.indexOf("Header::setupHeader('opener');");
    const link = php.indexOf(LINK);
    if (!(header > 0 && link > header && link < php.indexOf('<script>'))) {
        errors.push('link must follow the shared popup header and precede the original script');
    }
    for (const [anchor, expected] of ROUTE_ANCHORS) {
        if (count(php, anchor) !== expected) errors.push(`anchor ${JSON.stringify(anchor)}: ${count(php, anchor)} != ${expected}`);
        if (restored !== null && count(restored, anchor) !== expected) {
            errors.push(`inverse anchor ${JSON.stringify(anchor)}: ${count(restored, anchor)} != ${expected}`);
        }
    }
    return errors;
}

// Route business/presentation edits the contract must reject: [label, unique anchor, replacement].
const ROUTE_MUTATIONS = [
    ['CSRF reads GET', 'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);', 'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);'],
    ['CSRF guard removed', 'if (!empty($_POST)) {\n    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);\n}\n', ''],
    ['CSRF token field removed', '<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />', ''],
    ['search SQL arguments changed', '$res = main_code_set_search($allowed_codes, $search_term);', '$res = main_code_set_search($allowed_codes, $search_term, 50);'],
    ['target callback rewired', '"onclick=\'return selcode_target(" . attr_js($dynCodeType) .', '"onclick=\'return selcode(" . attr_js($dynCodeType) .'],
    [
        'normal opener callback renamed',
        '                var msg = opener.set_related(codetype, code, selector, codedesc);\n                if (msg) alert(msg);\n                dlgclose();',
        '                var msg = opener.set_related_target(codetype, code, selector, codedesc);\n                if (msg) alert(msg);\n                dlgclose();',
    ],
    ['clear control removed', "<button type='button' class='btn btn-danger btn-delete' value=''\n                            onclick=\"selcode('', '', '', '')\"></button>\n", ''],
    ['search control removed', "<button type='submit' class='btn btn-primary btn-search'", "<span class='btn btn-primary btn-search'"],
    ['body popup scope dropped', BODY, '<body onload="<?php echo $focus; ?>">'],
    ['body popup scope renamed', BODY, '<body class="oe-code-picker" onload="<?php echo $focus; ?>">'],
    ['document scope dropped', DOCUMENT_DIV, '<div class="container-fluid">'],
    ['stylesheet leaks to print', 'media="screen"', 'media="all"'],
    ['header font weight dropped', "<th class='font-weight-bold'><?php echo xlt('Code'); ?></th>", "<th><?php echo xlt('Code'); ?></th>"],
    ['inline font size added', "<table class='table table-striped table-responsive-sm'>", "<table class='table table-striped table-responsive-sm' style='font-size: 12px'>"],
];

// Representative real callers, the shared popup frame and the theme defaults.
// Exact bytes are compared in the baseline suite; anchors are portable.
const UNCHANGED = [
    'interface/patient_file/summary/immunizations.php',
    'interface/patient_file/history/history_full.php',
    'interface/billing/sl_receipts_report.php',
    'interface/forms/eye_mag/view.php',
    'interface/forms/observation/observation.js',
    'library/js/reasonCodeWidget.js',
    'interface/clinical-workspace/popup.js',
    'interface/clinical-workspace/popup.css',
    'interface/themes/theme-defaults.scss',
];
const CALLER_ANCHORS = [
    ['interface/patient_file/history/history_full.php', "dlgopen('../encounter/find_code_popup.php", 1],
    ['interface/patient_file/summary/immunizations.php', 'window.dlgopen("../encounter/find_code_popup.php?default=SNOMED-CT"', 1],
    ['interface/patient_file/summary/immunizations.php', "find_code_popup.php', '_blank', 700, 400);", 1],
    ['interface/billing/sl_receipts_report.php', "dlgopen('../patient_file/encounter/find_code_popup.php?target_element=form_proc_codefull&codetype='", 1],
    ['interface/billing/sl_receipts_report.php', "dlgopen('../patient_file/encounter/find_code_popup.php?target_element=form_dx_codefull&codetype='", 1],
    ['interface/forms/eye_mag/view.php', "/patient_file/encounter/find_code_popup.php?' + searchParams.toString(), '_blank', 600, 400", 2],
    ['interface/forms/observation/observation.js', 'find_code_popup.php', 1],
    ['library/js/reasonCodeWidget.js', 'window.dlgopen(webroot + "/interface/patient_file/encounter/find_code_popup.php"', 1],
    ['interface/clinical-workspace/popup.css', 'html.oe-workbench-popup .form-control:focus,', 1],
    ['interface/clinical-workspace/popup.css', 'html.oe-workbench-popup .btn-primary,', 1],
];

// ---- Minimal CSS reader (comments stripped, nested blocks, paren-aware selectors).

function splitTopLevel(text, separator) {
    const parts = [];
    let depth = 0;
    let current = '';
    for (const ch of text) {
        if (ch === '(' || ch === '[') depth++;
        if (ch === ')' || ch === ']') depth--;
        if (ch === separator && depth === 0) {
            parts.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    parts.push(current);
    return parts;
}

function parseCss(text) {
    const src = text.replace(/\/\*[\s\S]*?\*\//g, '');
    if (src.includes('/*')) throw new Error('unterminated comment');
    let i = 0;
    const flush = (buffer, nodes) => {
        const raw = buffer.trim();
        if (raw === '') return;
        const colon = raw.indexOf(':');
        if (colon < 1) throw new Error(`unparseable declaration: ${raw}`);
        let value = raw.slice(colon + 1).trim();
        const important = /!\s*important$/i.test(value);
        if (important) value = value.replace(/\s*!\s*important$/i, '');
        nodes.push({ type: 'decl', prop: raw.slice(0, colon).trim().toLowerCase(), value: value.replace(/\s+/g, ' '), important });
    };
    const block = depth => {
        const nodes = [];
        let buffer = '';
        while (i < src.length) {
            const ch = src[i++];
            if (ch === '{') {
                const head = buffer.trim();
                buffer = '';
                const children = block(depth + 1);
                if (head.startsWith('@')) {
                    const match = head.match(/^@([\w-]+)\s*([\s\S]*)$/);
                    nodes.push({ type: 'atrule', name: match[1], params: match[2].trim().replace(/\s+/g, ' '), nodes: children });
                } else {
                    nodes.push({ type: 'rule', selectors: splitTopLevel(head, ',').map(s => s.trim().replace(/\s+/g, ' ')), nodes: children });
                }
            } else if (ch === '}') {
                if (depth === 0) throw new Error('unbalanced closing brace');
                flush(buffer, nodes);
                return nodes;
            } else if (ch === ';') {
                flush(buffer, nodes);
                buffer = '';
            } else {
                buffer += ch;
            }
        }
        if (depth !== 0) throw new Error('unclosed block');
        flush(buffer, nodes);
        return nodes;
    };
    return block(0);
}

// ---- Exact planned stylesheet contract.

const SCOPE = 'html.oe-workbench-popup body.oe-code-picker-popup';
const DOC = `${SCOPE} .oe-code-picker-popup__document`;
const INK = 'var(--oe-wb-ink)';
const PAPER = 'var(--oe-wb-paper)';
const RING = [['outline', '2px solid var(--oe-wb-petrol)'], ['outline-offset', '1px']];

// Ordered: disabled/readonly must stay last so it wins over normal and focus pairs.
// Simple :focus fallbacks and :focus-visible rules are separate rules so a browser
// that rejects :focus-visible does not drop the fallback with it. Button and link
// focus rules carry only the ring: no button palette changes.
const CSS_RULES = [
    { selectors: [SCOPE], decls: [['background-color', 'var(--oe-wb-canvas)']] },
    { selectors: [DOC], decls: [['padding', '12px 16px'], ['color', INK], ['background-color', PAPER], ['border', '1px solid var(--oe-wb-line)']] },
    { selectors: [`${DOC} > .form-inline`, `${DOC} > .form-inline > .form-group`], decls: [['flex-wrap', 'wrap']] },
    { selectors: [`${DOC} .form-control`], decls: [['color', INK], ['background-color', PAPER]] },
    { selectors: [`${DOC} .form-control:focus`], decls: [['color', INK], ['background-color', PAPER], ...RING] },
    { selectors: [`${DOC} .form-control:focus-visible`], decls: [...RING] },
    { selectors: [`${DOC} .btn:focus`, `${DOC} a:focus`], decls: [...RING] },
    { selectors: [`${DOC} .btn:focus-visible`, `${DOC} a:focus-visible`], decls: [...RING] },
    { selectors: [`${DOC} .table`], decls: [['color', INK], ['background-color', PAPER]] },
    {
        selectors: [`${DOC} .form-control:disabled`, `${DOC} .form-control[readonly]`],
        decls: [['color', 'var(--oe-wb-disabled-ink)'], ['background-color', 'var(--oe-wb-disabled-paper)']],
    },
];

const FORBIDDEN_PROPS = /^(background|background-image|border-[\w-]+|box-shadow|font|font-[\w-]+|display|visibility|line-height|height|width|min-[\w-]+|max-[\w-]+)$/;
const FORBIDDEN_SELECTOR = /\.btn-|:hover|:active|nth-|table-striped|\btbody\b|\btr\b|\bth\b|\btd\b|#searchTerm|\bselect\b|\binput\b/;
// Shared button/link focus selectors: only a :focus / :focus-visible ring is allowed.
const CONTROL_SELECTOR = /\.btn\b|(?:^|\s)a(?=[:.[\s]|$)/;
const CONTROL_FOCUS_SELECTOR = /(?:\.btn|\sa):focus(?:-visible)?$/;
const RING_PROPS = ['outline', 'outline-offset'];

function serializeCss(rules = CSS_RULES) {
    const body = rules.map(rule => `  ${rule.selectors.join(',\n  ')} {\n${rule.decls.map(([p, v]) => `    ${p}: ${v};`).join('\n')}\n  }`).join('\n\n');
    return `@media screen {\n${body}\n}\n`;
}

// Real sheet as contract-shaped rules (for per-rule targeted mutations).
function sheetRules(text) {
    const tree = parseCss(text);
    if (tree.length !== 1 || tree[0].type !== 'atrule') throw new Error('expected a single at-rule');
    return tree[0].nodes.filter(n => n.type === 'rule').map(n => ({
        selectors: n.selectors,
        decls: n.nodes.filter(d => d.type === 'decl').map(d => [d.prop, d.important ? `${d.value} !important` : d.value]),
    }));
}

function cssContractErrors(text) {
    let tree;
    try {
        tree = parseCss(text);
    } catch (error) {
        return [`parse: ${error.message}`];
    }
    const errors = [];
    if (tree.length !== 1 || tree[0].type !== 'atrule' || tree[0].name !== 'media' || tree[0].params !== 'screen') {
        return ['top level must be exactly one @media screen block'];
    }
    const rules = tree[0].nodes;
    for (const node of rules) {
        if (node.type !== 'rule') {
            errors.push(`unexpected ${node.type} inside @media screen`);
            continue;
        }
        const controlRule = node.selectors.some(s => CONTROL_SELECTOR.test(s));
        for (const selector of node.selectors) {
            if (!selector.startsWith(`${DOC} `) && selector !== SCOPE && selector !== DOC) errors.push(`unscoped selector: ${selector}`);
            if (FORBIDDEN_SELECTOR.test(selector)) errors.push(`forbidden selector: ${selector}`);
            if (CONTROL_SELECTOR.test(selector) && !CONTROL_FOCUS_SELECTOR.test(selector)) errors.push(`button/link selector without focus: ${selector}`);
        }
        if (controlRule && node.selectors.some(s => !CONTROL_SELECTOR.test(s))) errors.push(`button/link focus mixed with other selectors: ${node.selectors[0]}`);
        const focusKinds = new Set(node.selectors.map(s => (/:focus-visible$/.test(s) ? 'visible' : /:focus$/.test(s) ? 'focus' : 'other')));
        if (focusKinds.has('visible') && focusKinds.size > 1) errors.push(`:focus-visible combined with other selectors: ${node.selectors[0]}`);
        for (const child of node.nodes) {
            if (child.type !== 'decl') {
                errors.push(`nested ${child.type} in ${node.selectors[0]}`);
                continue;
            }
            if (child.important) errors.push(`!important: ${child.prop}`);
            if (child.prop !== 'border' && FORBIDDEN_PROPS.test(child.prop)) errors.push(`forbidden property: ${child.prop}`);
            if (child.prop === 'border' && node.selectors.some(s => s !== DOC)) errors.push(`border outside document: ${node.selectors[0]}`);
            if (controlRule && !RING_PROPS.includes(child.prop)) errors.push(`button/link palette change: ${child.prop}`);
        }
    }
    const actual = rules.filter(n => n.type === 'rule').map(n => ({
        selectors: n.selectors,
        decls: n.nodes.filter(d => d.type === 'decl').map(d => [d.prop, d.important ? `${d.value} !important` : d.value]),
    }));
    if (JSON.stringify(actual) !== JSON.stringify(CSS_RULES)) {
        errors.push(`rules differ from contract:\n${JSON.stringify(actual, null, 1)}`);
    }
    return errors;
}

// Per-rule targeted stylesheet mutations. Each locates its rule by an exact
// selector (asserted unique) so no mutation can hit an unintended duplicate.
function ruleIndex(rules, selector) {
    const hits = rules.map((r, i) => (r.selectors.includes(selector) ? i : -1)).filter(i => i >= 0);
    if (hits.length !== 1) throw new Error(`selector must match exactly one rule: ${selector} (${hits.length})`);
    return hits[0];
}
const editRule = (selector, fn) => rules => {
    const i = ruleIndex(rules, selector);
    rules[i] = fn(rules[i]);
    return rules;
};
const setDecl = (prop, value) => rule => ({ ...rule, decls: rule.decls.map(([p, v]) => (p === prop ? [p, value] : [p, v])) });
const addDecl = (prop, value) => rule => ({ ...rule, decls: [...rule.decls, [prop, value]] });
const renameSelector = (from, to) => rule => ({ ...rule, selectors: rule.selectors.map(s => (s === from ? to : s)) });
const removeRule = selector => rules => rules.filter((_, i) => i !== ruleIndex(rules, selector));

const CSS_MUTATIONS = [
    ['canvas swapped', editRule(SCOPE, setDecl('background-color', PAPER))],
    ['document padding changed', editRule(DOC, setDecl('padding', '0'))],
    ['document font size added', editRule(DOC, addDecl('font-size', '14px'))],
    ['control shadow added', editRule(`${DOC} .form-control:focus`, addDecl('box-shadow', 'none'))],
    ['important override', editRule(`${DOC} .form-control:disabled`, setDecl('color', 'var(--oe-wb-disabled-ink) !important'))],
    ['form-control focus-visible dropped', removeRule(`${DOC} .form-control:focus-visible`)],
    ['form-control focus fallback dropped', removeRule(`${DOC} .form-control:focus`)],
    ['form-control focus fallback merged into focus-visible', rules => {
        const visible = ruleIndex(rules, `${DOC} .form-control:focus-visible`);
        rules[visible] = { ...rules[visible], selectors: [`${DOC} .form-control:focus`, ...rules[visible].selectors] };
        return rules;
    }],
    ['button focus fallback dropped', removeRule(`${DOC} .btn:focus`)],
    ['button focus-visible dropped', removeRule(`${DOC} .btn:focus-visible`)],
    ['button focus palette change', editRule(`${DOC} .btn:focus`, addDecl('background-color', PAPER))],
    ['button focus-visible palette change', editRule(`${DOC} .btn:focus-visible`, addDecl('color', INK))],
    ['button focus becomes hover', editRule(`${DOC} .btn:focus`, renameSelector(`${DOC} .btn:focus`, `${DOC} .btn:hover`))],
    ['button palette selector', editRule(`${DOC} .form-control[readonly]`, rule => ({ ...rule, selectors: [...rule.selectors, `${DOC} .btn-primary`] }))],
    ['link focus unscoped', editRule(`${DOC} a:focus`, renameSelector(`${DOC} a:focus`, 'a:focus'))],
    ['readonly hover', editRule(`${DOC} .form-control[readonly]`, renameSelector(`${DOC} .form-control[readonly]`, `${DOC} .form-control[readonly]:hover`))],
    ['wrap removed', editRule(`${DOC} > .form-inline`, rule => ({ ...rule, decls: [['flex-direction', 'column']] }))],
    ['table outside document', editRule(`${DOC} .table`, renameSelector(`${DOC} .table`, `${SCOPE} .table`))],
    ['disabled no longer last', rules => {
        const i = ruleIndex(rules, `${DOC} .form-control:disabled`);
        const [disabled] = rules.splice(i, 1);
        rules.splice(3, 0, disabled);
        return rules;
    }],
];

const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');

module.exports = {
    ROOT,
    BASELINE_COMMIT,
    ROUTE,
    ASSETS,
    CSS,
    UNCHANGED,
    CALLER_ANCHORS,
    ROUTE_ADDITIONS,
    ROUTE_ANCHORS,
    ROUTE_MUTATIONS,
    ASSET_ADDITIONS,
    PRESENTATION_MARKERS,
    LINK,
    CSS_RULES,
    CSS_MUTATIONS,
    SCOPE,
    DOC,
    read,
    count,
    reverse,
    routeContractErrors,
    parseCss,
    sheetRules,
    serializeCss,
    cssContractErrors,
    stripComments,
};
